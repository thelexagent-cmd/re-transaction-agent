"""Transaction and Party schemas."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.party import PartyRole
from app.models.transaction import PropertyType, TransactionStatus


# --- Party schemas ---

class PartyCreate(BaseModel):
    role: PartyRole
    full_name: str
    email: str | None = None
    phone: str | None = None


class PartyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    transaction_id: int
    role: PartyRole
    full_name: str
    email: str | None
    phone: str | None
    created_at: datetime


# --- Deadline schemas ---

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


# --- Event schemas ---

class EventResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    transaction_id: int
    event_type: str
    description: str
    dismissed: bool
    created_at: datetime


# --- Transaction schemas ---

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


# --- HOA workflow schemas ---

class HoaDocsDeliveredRequest(BaseModel):
    delivery_date: date


# --- Alert / deadline list schemas ---

class AlertListResponse(BaseModel):
    alerts: list[EventResponse]
    total: int


class DeadlineListResponse(BaseModel):
    deadlines: list[DeadlineResponse]
    total: int
