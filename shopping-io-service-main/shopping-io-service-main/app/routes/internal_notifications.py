from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.db import get_connection
from app.schemas import CreateNotificationRequest, NotificationResponse

router = APIRouter(prefix="/internal/notifications", tags=["internal-notifications"])


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(payload: CreateNotificationRequest) -> NotificationResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO notifications (user_id, list_id, message)
                VALUES (%s, %s, %s)
                RETURNING id, user_id, list_id, message, read, created_at
                """,
                (str(payload.user_id), str(payload.list_id), payload.message),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create notification",
        )

    return NotificationResponse.model_validate(row)


@router.get("", response_model=list[NotificationResponse])
def get_notifications(user_id: UUID = Query(...)) -> list[NotificationResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, user_id, list_id, message, read, created_at
                FROM notifications
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (str(user_id),),
            )
            rows = cursor.fetchall()

    return [NotificationResponse.model_validate(row) for row in rows]


@router.patch("/{notification_id}", response_model=NotificationResponse)
def mark_notification_as_read(notification_id: UUID) -> NotificationResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE notifications
                SET read = TRUE
                WHERE id = %s
                RETURNING id, user_id, list_id, message, read, created_at
                """,
                (str(notification_id),),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return NotificationResponse.model_validate(row)
