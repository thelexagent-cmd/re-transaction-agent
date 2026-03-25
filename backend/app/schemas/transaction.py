"""Transaction and Party schemas."""

import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, field_validator

from app.models.party import PartyRole
from app.models.transaction import PropertyType, TransactionStatus


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_phone(raw: str) -> str:
    """Strip non-digits and validate US 10-digit format. Returns digits only."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]  # Strip leading country code
    if len(digits) != 10:
        raise ValueError(
            f"Phone number must be a 10-digit US number (got {len(digits)} digits after stripping)"
        )
    return digits


# ── Party schemas ─────────────────────────────────────────────────────────────

class PartyCreate(BaseModel):
    role: PartyRole
    full_name: str
    email: EmailStr | None = None
    phone: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        return _normalize_phone(v)


class PartyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    transaction_id: int
    role: PartyRole
    full_name: str
    email: str | None
    phone: str | None
    created_at: datetime


# ── Deadline schemas ──────────────────────────────────────────────────────────

class DeadlineResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    transaction_id: int
    name: str
    due_date: date
    status: str
    alert_t3_sent: bool
    alert_t1_sent: bool
    created_at: datetime


# ── Event schemas ─────────────────────────────────────────────────────────────

class EventResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    transaction_id: int
    event_type: str
    description: str
    dismissed: bool
    created_at: datetime


# ── Transaction schemas ───────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    address: str
    property_type: PropertyType = PropertyType.sfh
    purchase_price: Decimal | None = None
    closing_date: date | None = None
    contract_execution_date: date | None = None
    parties: list[PartyCreate] = []

    @field_validator("purchase_price")
    @classmethod
    def purchase_price_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("Purchase price must be positive")
        return v

    @field_validator("closing_date")
    @classmethod
    def closing_date_future(cls, v: date | None) -> date | None:
        if v is not None and v < date.today():
            raise ValueError("Closing date must be today or in the future")
        return v


class TransactionListItem(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    address: str
    property_type: PropertyType
    status: TransactionStatus
    purchase_price: Decimal | None
    closing_date: date | None
    contract_execution_date: date | None
    created_at: datetime
    updated_at: datetime


class TransactionDetail(TransactionListItem):
    parties: list[PartyResponse] = []
    deadlines: list[DeadlineResponse] = []
    events: list[EventResponse] = []


# ── HOA workflow schemas ──────────────────────────────────────────────────────

class HoaDocsDeliveredRequest(BaseModel):
    delivery_date: date


# ── Alert / deadline list schemas ─────────────────────────────────────────────

class AlertListResponse(BaseModel):
    alerts: list[EventResponse]
    total: int


class DeadlineListResponse(BaseModel):
    deadlines: list[DeadlineResponse]
    total: int


class RecentEventItem(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    transaction_id: int
    transaction_address: str
    event_type: str
    description: str
    dismissed: bool
    created_at: datetime


class RecentEventsResponse(BaseModel):
    events: list[RecentEventItem]
    total: int
