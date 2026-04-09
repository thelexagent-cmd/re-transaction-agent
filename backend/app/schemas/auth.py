"""Auth-related request and response schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    brokerage_name: str | None = None
    turnstile_token: str | None = None  # Cloudflare Turnstile CAPTCHA

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
    def full_name_length(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Full name is required")
        if len(v) > 200:
            raise ValueError("Full name must be at most 200 characters")
        return v.strip()

    @field_validator("brokerage_name")
    @classmethod
    def brokerage_name_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 200:
            raise ValueError("Brokerage name must be at most 200 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    turnstile_token: str | None = None  # Cloudflare Turnstile CAPTCHA


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    full_name: str
    brokerage_name: str | None
    avatar_url: str | None = None
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    brokerage_name: str | None = None
    avatar_url: str | None = None

    @field_validator("full_name")
    @classmethod
    def full_name_length(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Full name cannot be empty")
        if len(v) > 200:
            raise ValueError("Full name must be at most 200 characters")
        return v

    @field_validator("brokerage_name")
    @classmethod
    def brokerage_name_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 200:
            raise ValueError("Brokerage name must be at most 200 characters")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        return v
