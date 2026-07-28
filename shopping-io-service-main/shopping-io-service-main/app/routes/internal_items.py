from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.db import get_connection
from app.schemas import (
    CreateItemRequest,
    DeleteItemResponse,
    ItemResponse,
    UpdateItemRequest,
)

router = APIRouter(prefix="/internal/items", tags=["internal-items"])


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(payload: CreateItemRequest) -> ItemResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id FROM items
                WHERE list_id = %s AND LOWER(name) = LOWER(%s)
                """,
                (str(payload.list_id), payload.name),
            )
            existing = cursor.fetchone()
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Item with this name already exists in this list",
                )

            cursor.execute(
                """
                INSERT INTO items (list_id, name, quantity, estimated_price)
                VALUES (%s, %s, %s, %s)
                RETURNING id, list_id, name, quantity, estimated_price, checked, created_at, updated_at
                """,
                (
                    str(payload.list_id),
                    payload.name,
                    payload.quantity,
                    payload.estimated_price,
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create item",
        )

    return ItemResponse.model_validate(row)


@router.get("", response_model=list[ItemResponse])
def get_items(list_id: UUID = Query(...)) -> list[ItemResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, list_id, name, quantity, estimated_price, checked, created_at, updated_at
                FROM items
                WHERE list_id = %s
                ORDER BY created_at ASC
                """,
                (str(list_id),),
            )
            rows = cursor.fetchall()

    return [ItemResponse.model_validate(row) for row in rows]


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(payload: UpdateItemRequest, item_id: UUID = Path(...)) -> ItemResponse:
    if (
        payload.name is None
        and payload.quantity is None
        and payload.estimated_price is None
        and payload.checked is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update",
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            if payload.name is not None:
                cursor.execute(
                    """
                    SELECT id FROM items
                    WHERE list_id = %s AND LOWER(name) = LOWER(%s) AND id != %s
                    """,
                    (str(payload.list_id), payload.name, str(item_id)),
                )
                existing = cursor.fetchone()
                if existing is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Item with this name already exists in this list",
                    )

            cursor.execute(
                """
                UPDATE items
                SET
                    name = COALESCE(%s, name),
                    quantity = COALESCE(%s, quantity),
                    estimated_price = COALESCE(%s, estimated_price),
                    checked = COALESCE(%s, checked),
                    updated_at = NOW()
                WHERE id = %s AND list_id = %s
                RETURNING id, list_id, name, quantity, estimated_price, checked, created_at, updated_at
                """,
                (
                    payload.name,
                    payload.quantity,
                    payload.estimated_price,
                    payload.checked,
                    str(item_id),
                    str(payload.list_id),
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    return ItemResponse.model_validate(row)


@router.delete("/{item_id}", response_model=DeleteItemResponse)
def delete_item(item_id: UUID, list_id: UUID = Query(...)) -> DeleteItemResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM items
                WHERE id = %s AND list_id = %s
                RETURNING id
                """,
                (str(item_id), str(list_id)),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    return DeleteItemResponse(message="Item deleted successfully")
