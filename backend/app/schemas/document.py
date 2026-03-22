"""Document schemas."""

from datetime import date, datetime

from pydantic import BaseModel, field_validator

from app.models.document import DocumentStatus
from app.models.party import PartyRole


class DocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    transaction_id: int
    phase: int
    name: str
    status: DocumentStatus
    responsible_party_role: str | None
    due_date: date | None
    collected_at: datetime | None
    storage_key: str | None
    last_followup_at: datetime | None
    created_at: datetime


class DocumentUploadResponse(DocumentResponse):
    """Response after a document file has been uploaded."""
    pass


class DocumentCollectRequest(BaseModel):
    """Manual override to mark a document as collected."""
    notes: str | None = None  # Optional broker note, stored as an event
