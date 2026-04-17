"""Invite endpoints — create, validate, and accept broker-to-agent invites."""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.invite import Invite
from app.models.user import User
from app.schemas.auth import TokenResponse

logger = logging.getLogger(__name__)

_FRONTEND_URL = os.getenv("FRONTEND_URL", "https://frontend-rose-ten-64.vercel.app")
_INVITE_TTL_DAYS = 7

router = APIRouter(prefix="/auth/invites", tags=["invites"])
limiter = Limiter(key_func=get_remote_address)


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateInviteRequest(BaseModel):
    invitee_email: EmailStr | None = None


class InviteResponse(BaseModel):
    token: str
    link: str
    expires_at: datetime
    invitee_email: str | None = None


class ValidateInviteResponse(BaseModel):
    valid: bool
    broker_name: str
    brokerage_name: str | None
    invitee_email: str | None
    expires_at: datetime


class AcceptInviteRequest(BaseModel):
    token: str
    full_name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name is required")
        if len(v) > 200:
            raise ValueError("Full name must be at most 200 characters")
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

import bcrypt


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/create", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_invite(
    request: Request,
    body: CreateInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a single-use invite link for a new agent.

    Only brokers (role='broker') can create invites.
    """
    if current_user.role != "broker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only brokers can create invites.",
        )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(tz=timezone.utc) + timedelta(days=_INVITE_TTL_DAYS)

    invite = Invite(
        token=token,
        broker_id=current_user.id,
        invitee_email=body.invitee_email,
        used=False,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    link = f"{_FRONTEND_URL}/invite/{token}"
    logger.info("Broker %d created invite token (expires %s)", current_user.id, expires_at.isoformat())
    return {"token": token, "link": link, "expires_at": expires_at, "invitee_email": body.invitee_email}


@router.get("/validate/{token}", response_model=ValidateInviteResponse)
@limiter.limit("30/minute")
async def validate_invite(request: Request, token: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Validate an invite token (public endpoint).

    Returns broker info so the signup form can show who invited the agent.
    Returns 400 if the invite is invalid, expired, or already used.
    """
    result = await db.execute(select(Invite).where(Invite.token == token))
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite not found.")

    if invite.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite has already been used.")

    now = datetime.now(tz=timezone.utc)
    if invite.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite has expired.")

    broker_result = await db.execute(select(User).where(User.id == invite.broker_id))
    broker = broker_result.scalar_one_or_none()
    if broker is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite is no longer valid.")

    return {
        "valid": True,
        "broker_name": broker.full_name,
        "brokerage_name": broker.brokerage_name,
        "invitee_email": invite.invitee_email,
        "expires_at": invite.expires_at,
    }


@router.post("/accept", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def accept_invite(
    request: Request,
    body: AcceptInviteRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Accept an invite and create a new agent account.

    Security:
    - Uses SELECT FOR UPDATE to prevent race conditions on concurrent accepts
    - broker_id is taken from the invite — never from client input
    - Marks invite as used atomically before returning
    """
    # SELECT FOR UPDATE — prevents two simultaneous accepts
    result = await db.execute(
        select(Invite).where(Invite.token == body.token).with_for_update()
    )
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite not found.")

    if invite.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite has already been used.")

    now = datetime.now(tz=timezone.utc)
    if invite.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite has expired.")

    # Normalize email to prevent duplicate registrations via case variation
    normalized_email = body.email.lower()

    # Check email not already registered
    existing = await db.execute(select(User).where(User.email == normalized_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

    # Create agent user — broker_id comes from invite (not client)
    agent = User(
        email=normalized_email,
        hashed_password=_hash_password(body.password),
        full_name=body.full_name,
        role="agent",
        broker_id=invite.broker_id,
        brokerage_name=None,  # agents inherit brokerage from broker
    )
    db.add(agent)
    await db.flush()  # get agent.id

    # Mark invite used
    invite.used = True
    invite.used_by_user_id = agent.id

    await db.commit()
    await db.refresh(agent)

    # Issue JWT
    from app.config import settings
    from datetime import timedelta
    from jose import jwt as jose_jwt
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    token = jose_jwt.encode({"sub": str(agent.id), "exp": expire}, settings.secret_key, algorithm=settings.algorithm)

    logger.info("Agent %d joined under broker %d via invite %d", agent.id, invite.broker_id, invite.id)
    return {"access_token": token, "token_type": "bearer"}
