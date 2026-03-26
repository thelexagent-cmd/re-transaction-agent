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

    @field_validator("full_name")
    @classmethod
    def full_name_length(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Full name is required")
        if len(v) > 200:
            raise ValueError("Full name must be at most 200 characters")
        return v.strip()

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

    @field_validator("address")
    @classmethod
    def address_length(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Address is required")
        if len(v) > 500:
            raise ValueError("Address must be at most 500 characters")
        return v.strip()

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
    notes: str | None = None
    emd_amount: Decimal | None = None
    emd_holder: str | None = None
    emd_due_date: date | None = None
    emd_received: bool = False
    emd_notes: str | None = None
    created_at: datetime
    updated_at: datetime


class TransactionDetail(TransactionListItem):
    parties: list[PartyResponse] = []
    deadlines: list[DeadlineResponse] = []
    events: list[EventResponse] = []


# ── Transaction notes schemas ─────────────────────────────────────────────────

class NotesResponse(BaseModel):
    notes: str | None


class NotesUpdate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_length(cls, v: str) -> str:
        if len(v) > 50000:
            raise ValueError("Notes must be at most 50000 characters")
        return v


# ── Transaction status update schema ──────────────────────────────────────────

class TransactionUpdate(BaseModel):
    status: TransactionStatus | None = None
    closing_date: date | None = None
    purchase_price: Decimal | None = None
    contract_execution_date: date | None = None
    notes: str | None = None
    emd_amount: Decimal | None = None
    emd_holder: str | None = None
    emd_due_date: date | None = None
    emd_received: bool | None = None
    emd_notes: str | None = None

    @field_validator("purchase_price")
    @classmethod
    def purchase_price_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("Purchase price must be positive")
        return v


# ── Dashboard stats schema ─────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_active: int
    closing_this_month: int
    overdue_documents: int
    missed_deadlines: int


# ── Global contacts schema ────────────────────────────────────────────────────

class ContactItem(BaseModel):
    id: int
    full_name: str
    email: str | None
    phone: str | None
    role: str
    transaction_count: int
    transaction_ids: list[int]


class ContactsResponse(BaseModel):
    contacts: list[ContactItem]
    total: int


# ── Health score schema ───────────────────────────────────────────────────────

class HealthFactor(BaseModel):
    name: str
    impact: int
    detail: str


class HealthScoreResponse(BaseModel):
    score: int
    level: str
    factors: list[HealthFactor]


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


# ── Party update schema ───────────────────────────────────────────────────────

class PartyUpdate(BaseModel):
    preferred_language: str | None = None
    is_foreign_national: bool | None = None

    @field_validator("preferred_language")
    @classmethod
    def preferred_language_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 10:
            raise ValueError("Preferred language code must be at most 10 characters")
        return v


# ── Portal token schema ───────────────────────────────────────────────────────

class PortalTokenResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    token: str
    transaction_id: int
    expires_at: datetime


# ── FIRPTA analysis schema ────────────────────────────────────────────────────

class FirptaAnalysis(BaseModel):
    is_firpta_applicable: bool
    withholding_amount: float
    withholding_rate: float
    gross_sales_price: float
    notes: list[str]
    action_items: list[str]


# ── Report summary schema ─────────────────────────────────────────────────────

class MonthlyDataPoint(BaseModel):
    month: str
    created: int
    closed: int
    volume: float


class ReportSummary(BaseModel):
    total_transactions: int
    active: int
    closed: int
    cancelled: int
    avg_days_to_close: float | None
    total_volume: float
    monthly_data: list[MonthlyDataPoint]
