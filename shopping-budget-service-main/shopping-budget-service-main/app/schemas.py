from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class BudgetListResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    max_budget: Decimal


class ItemResponse(BaseModel):
    id: UUID
    list_id: UUID
    name: str
    quantity: int
    estimated_price: Decimal
    checked: bool


class BudgetStatusResponse(BaseModel):
    list_id: UUID
    max_budget: Decimal
    current_total: Decimal
    remaining_budget: Decimal
    status: str


class ListRecipientResponse(BaseModel):
    user_id: UUID
    email: str
    role: str
