from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class CreateUserRequest(BaseModel):
    email: str
    password_hash: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    password_hash: str
    created_at: datetime


class CreateListRequest(BaseModel):
    owner_id: UUID
    name: str
    max_budget: Decimal = Decimal("0")


class UpdateListRequest(BaseModel):
    owner_id: UUID
    name: str | None = None
    max_budget: Decimal | None = None


class DeleteListRequest(BaseModel):
    owner_id: UUID


class ListResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    max_budget: Decimal
    created_at: datetime


class DeleteListResponse(BaseModel):
    message: str


class ShareListRequest(BaseModel):
    list_id: UUID
    owner_id: UUID
    user_id: UUID
    user_email: str
    role: Literal["owner", "editor", "viewer"] = "editor"


class ShareListResponse(BaseModel):
    list_id: UUID
    shared_with: str
    role: Literal["owner", "editor", "viewer"]


class MembershipActionResponse(BaseModel):
    message: str


class ListMemberResponse(BaseModel):
    user_id: UUID
    email: str
    role: Literal["owner", "editor", "viewer"]
    created_at: datetime


class ListRecipientResponse(BaseModel):
    user_id: UUID
    email: str
    role: Literal["owner", "editor", "viewer"]


class VerifyListAccessResponse(BaseModel):
    list_id: UUID
    user_id: UUID
    role: Literal["owner", "editor", "viewer"]


class CreateItemRequest(BaseModel):
    list_id: UUID
    name: str
    quantity: int = 1
    estimated_price: Decimal = Decimal("0")


class UpdateItemRequest(BaseModel):
    list_id: UUID
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


class BudgetListResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    max_budget: Decimal
    created_at: datetime


class CreateNotificationRequest(BaseModel):
    user_id: UUID
    list_id: UUID
    message: str


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    list_id: UUID
    message: str
    read: bool
    created_at: datetime


class CreateCommentRequest(BaseModel):
    list_id: UUID
    user_id: UUID
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
