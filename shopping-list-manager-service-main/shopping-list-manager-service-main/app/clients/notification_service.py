from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import NotificationResponse


async def create_notification(user_id: UUID, list_id: UUID, message: str) -> NotificationResponse:
    async with httpx.AsyncClient(base_url=settings.notification_service_url, timeout=10.0) as client:
        response = await client.post(
            "/internal/notifications",
            json={
                "user_id": str(user_id),
                "list_id": str(list_id),
                "message": message,
            },
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Notification service failed to create notification",
        )

    return NotificationResponse.model_validate(response.json())


async def get_notifications(user_id: UUID) -> list[NotificationResponse]:
    async with httpx.AsyncClient(base_url=settings.notification_service_url, timeout=10.0) as client:
        response = await client.get("/internal/notifications", params={"user_id": str(user_id)})

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Notification service failed to fetch notifications",
        )

    return [NotificationResponse.model_validate(item) for item in response.json()]


async def mark_notification_as_read(notification_id: UUID) -> NotificationResponse:
    async with httpx.AsyncClient(base_url=settings.notification_service_url, timeout=10.0) as client:
        response = await client.patch(f"/internal/notifications/{notification_id}")

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Notification service failed to mark notification as read",
        )

    return NotificationResponse.model_validate(response.json())
