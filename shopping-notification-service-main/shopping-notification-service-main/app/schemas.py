from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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
