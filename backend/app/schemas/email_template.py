"""Email template schemas."""

from datetime import datetime

from pydantic import BaseModel


class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str


class EmailTemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body: str | None = None


class EmailTemplateResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    name: str
    subject: str
    body: str
    created_at: datetime
    updated_at: datetime
