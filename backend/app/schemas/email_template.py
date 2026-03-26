"""Email template schemas."""

from datetime import datetime

from pydantic import BaseModel, field_validator


class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Template name is required")
        if len(v) > 200:
            raise ValueError("Template name must be at most 200 characters")
        return v.strip()

    @field_validator("subject")
    @classmethod
    def subject_length(cls, v: str) -> str:
        if len(v) > 500:
            raise ValueError("Subject must be at most 500 characters")
        return v

    @field_validator("body")
    @classmethod
    def body_length(cls, v: str) -> str:
        if len(v) > 50000:
            raise ValueError("Body must be at most 50000 characters")
        return v


class EmailTemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body: str | None = None

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 200:
            raise ValueError("Template name must be at most 200 characters")
        return v.strip() if v else v

    @field_validator("subject")
    @classmethod
    def subject_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("Subject must be at most 500 characters")
        return v

    @field_validator("body")
    @classmethod
    def body_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 50000:
            raise ValueError("Body must be at most 50000 characters")
        return v


class EmailTemplateResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    name: str
    subject: str
    body: str
    created_at: datetime
    updated_at: datetime
