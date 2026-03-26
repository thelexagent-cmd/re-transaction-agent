"""Email template endpoints — CRUD for reusable broker email templates."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.email_template import EmailTemplate
from app.models.user import User
from app.schemas.email_template import (
    EmailTemplateCreate,
    EmailTemplateResponse,
    EmailTemplateUpdate,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[EmailTemplateResponse])
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EmailTemplate]:
    """Return all email templates owned by the authenticated broker, newest first."""
    result = await db.execute(
        select(EmailTemplate)
        .where(EmailTemplate.user_id == current_user.id)
        .order_by(EmailTemplate.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: EmailTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailTemplate:
    """Create a new email template for the authenticated broker.

    Body: name, subject, body
    """
    template = EmailTemplate(
        user_id=current_user.id,
        name=body.name,
        subject=body.subject,
        body=body.body,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


@router.put("/{template_id}", response_model=EmailTemplateResponse)
async def update_template(
    template_id: int,
    body: EmailTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailTemplate:
    """Update an existing email template.

    Only the fields provided in the body are updated.
    Raises 404 if the template does not belong to the authenticated broker.
    """
    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.id == template_id,
            EmailTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    if body.name is not None:
        template.name = body.name
    if body.subject is not None:
        template.subject = body.subject
    if body.body is not None:
        template.body = body.body

    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an email template.

    Raises 404 if the template does not belong to the authenticated broker.
    """
    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.id == template_id,
            EmailTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    await db.delete(template)
