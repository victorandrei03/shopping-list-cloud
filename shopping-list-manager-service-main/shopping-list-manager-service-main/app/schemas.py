from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class CreateListRequest(BaseModel):
    name: str
    max_budget: Decimal = Decimal("0")


class UpdateListRequest(BaseModel):
    name: str | None = None
    max_budget: Decimal | None = None


class ListResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    max_budget: Decimal
    created_at: datetime


class DeleteListResponse(BaseModel):
    message: str


class ValidateTokenResponse(BaseModel):
    valid: bool
    user_id: UUID
    email: str


class IoListResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    max_budget: Decimal
    created_at: datetime


class IoDeleteListResponse(BaseModel):
    message: str


class ShareListRequest(BaseModel):
    user_email: str
    role: Literal["owner", "editor", "viewer"] = "editor"


class ShareListResponse(BaseModel):
    list_id: UUID
    shared_with: str
    role: Literal["owner", "editor", "viewer"]


class MembershipActionResponse(BaseModel):
    message: str


class IoUserResponse(BaseModel):
    id: UUID
    email: str


class ListMemberResponse(BaseModel):
    user_id: UUID
    email: str
    role: Literal["owner", "editor", "viewer"]
    created_at: datetime


class VerifyListAccessResponse(BaseModel):
    list_id: UUID
    user_id: UUID
    role: Literal["owner", "editor", "viewer"]


class CreateItemRequest(BaseModel):
    name: str
    quantity: int = 1
    estimated_price: Decimal = Decimal("0")


class UpdateItemRequest(BaseModel):
    name: str | None = None
    quantity: int | None = None
    estimated_price: Decimal | None = None
    checked: bool | None = None


class ItemResponse(BaseModel):
    id: UUID
    list_id: UUID
    name: str
    quantity: int
    estimated_price: Decimal
    checked: bool
    created_at: datetime
    updated_at: datetime


class DeleteItemResponse(BaseModel):
    message: str


class BulkCheckItemsResponse(BaseModel):
    message: str
    status: str


class MostExpensiveItemResponse(BaseModel):
    name: str
    price: Decimal


class SpendingAnalysisResponse(BaseModel):
    total_items: int
    total_list_value: Decimal = Decimal("0")
    average_item_price: Decimal = Decimal("0")
    most_expensive_item: MostExpensiveItemResponse | None = None
    currency: str = "RON"


class BudgetStatusResponse(BaseModel):
    list_id: UUID
    max_budget: Decimal
    current_total: Decimal
    remaining_budget: Decimal
    status: str


class UpdateBudgetRequest(BaseModel):
    max_budget: Decimal


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    list_id: UUID
    message: str
    read: bool
    created_at: datetime


class CreateCommentRequest(BaseModel):
    content: str
    x_percent: Decimal
    y_percent: Decimal
    width_percent: Decimal
    height_percent: Decimal


class UpdateCommentRequest(BaseModel):
    content: str | None = None
    x_percent: Decimal | None = None
    y_percent: Decimal | None = None
    width_percent: Decimal | None = None
    height_percent: Decimal | None = None
    user_id: UUID | None = None


class CommentResponse(BaseModel):
    id: UUID
    list_id: UUID
    user_id: UUID
    content: str
    x_percent: Decimal
    y_percent: Decimal
    width_percent: Decimal
    height_percent: Decimal
    created_at: datetime
    updated_at: datetime


class CommentActionResponse(BaseModel):
    message: str
