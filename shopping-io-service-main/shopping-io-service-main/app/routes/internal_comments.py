from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, status

from app.db import get_connection
from app.schemas import (
    CommentActionResponse,
    CommentResponse,
    CreateCommentRequest,
    UpdateCommentRequest,
)

router = APIRouter(prefix="/internal", tags=["internal-comments"])


@router.post("/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(payload: CreateCommentRequest) -> CommentResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO list_annotations (
                    list_id,
                    user_id,
                    content,
                    x_percent,
                    y_percent,
                    width_percent,
                    height_percent
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING
                    id,
                    list_id,
                    user_id,
                    content,
                    x_percent,
                    y_percent,
                    width_percent,
                    height_percent,
                    created_at,
                    updated_at
                """,
                (
                    str(payload.list_id),
                    str(payload.user_id),
                    payload.content,
                    payload.x_percent,
                    payload.y_percent,
                    payload.width_percent,
                    payload.height_percent,
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create comment",
        )

    return CommentResponse.model_validate(row)


@router.get("/lists/{list_id}/comments", response_model=list[CommentResponse])
def get_comments_by_list(list_id: UUID = Path(...)) -> list[CommentResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    list_id,
                    user_id,
                    content,
                    x_percent,
                    y_percent,
                    width_percent,
                    height_percent,
                    created_at,
                    updated_at
                FROM list_annotations
                WHERE list_id = %s
                ORDER BY created_at ASC
                """,
                (str(list_id),),
            )
            rows = cursor.fetchall()

    return [CommentResponse.model_validate(row) for row in rows]


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
def update_comment(
    payload: UpdateCommentRequest,
    comment_id: UUID = Path(...),
) -> CommentResponse:
    if (
        payload.content is None
        and payload.x_percent is None
        and payload.y_percent is None
        and payload.width_percent is None
        and payload.height_percent is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update",
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE list_annotations
                SET
                    content = COALESCE(%s, content),
                    x_percent = COALESCE(%s, x_percent),
                    y_percent = COALESCE(%s, y_percent),
                    width_percent = COALESCE(%s, width_percent),
                    height_percent = COALESCE(%s, height_percent),
                    user_id = COALESCE(%s, user_id),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING
                    id,
                    list_id,
                    user_id,
                    content,
                    x_percent,
                    y_percent,
                    width_percent,
                    height_percent,
                    created_at,
                    updated_at
                """,
                (
                    payload.content,
                    payload.x_percent,
                    payload.y_percent,
                    payload.width_percent,
                    payload.height_percent,
                    str(payload.user_id) if payload.user_id is not None else None,
                    str(comment_id),
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return CommentResponse.model_validate(row)


@router.delete("/comments/{comment_id}", response_model=CommentActionResponse)
def delete_comment(comment_id: UUID = Path(...)) -> CommentActionResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM list_annotations
                WHERE id = %s
                RETURNING id
                """,
                (str(comment_id),),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return CommentActionResponse(message="Comment deleted successfully")
