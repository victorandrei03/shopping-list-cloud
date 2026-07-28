from uuid import UUID

from fastapi import APIRouter, Query, status

from app.clients.io_service import create_notification, get_notifications
from app.schemas import CreateNotificationRequest, NotificationResponse

router = APIRouter(prefix="/internal", tags=["notifications"])


@router.post("/notifications", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification_endpoint(payload: CreateNotificationRequest) -> NotificationResponse:
    return await create_notification(
        user_id=payload.user_id,
        list_id=payload.list_id,
        message=payload.message,
    )


@router.get("/notifications", response_model=list[NotificationResponse])
async def get_notifications_endpoint(user_id: UUID = Query(...)) -> list[NotificationResponse]:
    return await get_notifications(user_id)


@router.patch("/notifications/{notification_id}", response_model=NotificationResponse)
async def mark_notification_read_endpoint(notification_id: UUID) -> NotificationResponse:
    from app.clients.io_service import mark_notification_as_read
    return await mark_notification_as_read(notification_id)
