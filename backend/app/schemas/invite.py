"""Invite request and response schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class InviteCreateRequest(BaseModel):
    """Body for POST /invites/create. email is optional — pre-fills the signup form."""

    email: EmailStr | None = None


class InviteCreateResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    token: str
    invite_url: str
    email: str | None
    expires_at: datetime
    brokerage_name: str


class InviteValidateResponse(BaseModel):
    """Returned by GET /invites/validate/:token when the invite is valid."""

    valid: bool
    brokerage_name: str
    email: str | None = None


class InviteAcceptRequest(BaseModel):
    """Body for POST /invites/accept."""

    token: str
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name is required")
        if len(v) > 200:
            raise ValueError("Full name must be at most 200 characters")
        return v
