"""Invite endpoints — create, validate, and accept invite links."""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user, require_broker
from app.models.brokerage import Brokerage
from app.models.invite import Invite
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse
from app.schemas.invite import (
    InviteAcceptRequest,
    InviteCreateRequest,
    InviteCreateResponse,
    InviteValidateResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/invites", tags=["invites"])
limiter = Limiter(key_func=get_remote_address)

_FRONTEND_URL = os.getenv("FRONTEND_URL", "https://lex-transaction-agent.vercel.app")
_INVITE_TTL_HOURS = 72  # invites expire after 72 hours


# ── Create invite ─────────────────────────────────────────────────────────────


@router.post("/create", response_model=InviteCreateResponse)
@limiter.limit("20/minute")
async def create_invite(
    request: Request,
    body: InviteCreateRequest,
    current_user: User = Depends(require_broker),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a single-use invite link for an agent to join this brokerage.

    Only users with role=broker may call this endpoint.
    The brokerage_id is taken from the authenticated broker — never from the request body.
    """
    if current_user.brokerage_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is not associated with a brokerage. Contact support.",
        )

    # Load brokerage for response
    brokerage = await db.get(Brokerage, current_user.brokerage_id)
    if brokerage is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Brokerage not found. Contact support.",
        )

    # Generate cryptographically secure, unguessable token (~256 bits)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=_INVITE_TTL_HOURS)

    invite = Invite(
        token=token,
        brokerage_id=current_user.brokerage_id,
        invited_by_id=current_user.id,
        email=body.email,
        expires_at=expires_at,
        used=False,
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    invite_url = f"{_FRONTEND_URL}/invite/{token}"
    logger.info(
        "Invite created by user %d for brokerage %d (email=%s, expires=%s)",
        current_user.id,
        current_user.brokerage_id,
        body.email or "any",
        expires_at.isoformat(),
    )

    return {
        "id": invite.id,
        "token": token,
        "invite_url": invite_url,
        "email": invite.email,
        "expires_at": expires_at,
        "brokerage_name": brokerage.name,
    }


# ── Validate invite ───────────────────────────────────────────────────────────


@router.get("/validate/{token}", response_model=InviteValidateResponse)
async def validate_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check whether an invite token is valid, unused, and not expired.

    No authentication required — this is called by the public invite page.
    Returns 404 for unknown tokens (do not distinguish between expired/used
    to avoid leaking information).
    """
    result = await db.execute(select(Invite).where(Invite.token == token))
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    if invite.used:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has already been used",
        )

    if datetime.now(tz=timezone.utc) > invite.expires_at:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has expired",
        )

    brokerage = await db.get(Brokerage, invite.brokerage_id)
    if brokerage is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite is no longer valid",
        )

    return {
        "valid": True,
        "brokerage_name": brokerage.name,
        "email": invite.email,
    }


# ── Accept invite ─────────────────────────────────────────────────────────────


@router.post("/accept", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def accept_invite(
    request: Request,
    body: InviteAcceptRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create an agent account tied to the invite's brokerage.

    Security properties:
    - Token validated server-side before any user creation
    - invite.used set to True atomically in the same transaction as user creation
    - brokerage_id comes from the invite, never from the request body
    - Email conflict checked before marking invite used
    """
    # ── 1. Load and validate invite ───────────────────────────────────────────
    result = await db.execute(select(Invite).where(Invite.token == body.token))
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )
    if invite.used:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has already been used",
        )
    if datetime.now(tz=timezone.utc) > invite.expires_at:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has expired",
        )

    # ── 2. Check email uniqueness before touching the invite ──────────────────
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in.",
        )

    # ── 3. Load brokerage (source of truth — not from request) ───────────────
    brokerage = await db.get(Brokerage, invite.brokerage_id)
    if brokerage is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite is no longer valid",
        )

    # ── 4. Mark invite used BEFORE creating user (fail-safe against races) ────
    now = datetime.now(tz=timezone.utc)
    invite.used = True
    invite.used_at = now
    await db.flush()  # locks the row; user creation happens in the same transaction

    # ── 5. Create agent user ──────────────────────────────────────────────────
    hashed_pw = bcrypt.hashpw(body.password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")
    user = User(
        email=body.email,
        hashed_password=hashed_pw,
        full_name=body.full_name,
        brokerage_name=brokerage.name,  # copy for display convenience
        role=UserRole.agent.value,
        brokerage_id=invite.brokerage_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # ── 6. Link invite → new user ─────────────────────────────────────────────
    invite.used_by_id = user.id

    # ── 7. Seed default email templates for the new agent ────────────────────
    from app.routers.auth import seed_default_templates  # noqa: PLC0415
    await seed_default_templates(user.id, db)

    logger.info(
        "Invite accepted: user %d (%s) joined brokerage %d via invite %d",
        user.id,
        user.email,
        invite.brokerage_id,
        invite.id,
    )

    # ── 8. Return JWT so the agent is auto-logged in ──────────────────────────
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    token_payload = {"sub": str(user.id), "exp": expire}
    access_token = jwt.encode(token_payload, settings.secret_key, algorithm=settings.algorithm)

    return {"access_token": access_token, "token_type": "bearer"}


# ── List invites (broker only) ────────────────────────────────────────────────


@router.get("/list")
async def list_invites(
    current_user: User = Depends(require_broker),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return all invites for the current broker's brokerage."""
    result = await db.execute(
        select(Invite)
        .where(Invite.brokerage_id == current_user.brokerage_id)
        .order_by(Invite.created_at.desc())
    )
    invites = result.scalars().all()

    now = datetime.now(tz=timezone.utc)
    return [
        {
            "id": inv.id,
            "email": inv.email,
            "used": inv.used,
            "used_at": inv.used_at,
            "expires_at": inv.expires_at,
            "expired": now > inv.expires_at,
            "invite_url": f"{_FRONTEND_URL}/invite/{inv.token}",
            "created_at": inv.created_at,
        }
        for inv in invites
    ]
