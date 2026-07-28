from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.db import get_connection
from app.schemas import (
    BudgetListResponse,
    CreateListRequest,
    DeleteListRequest,
    DeleteListResponse,
    ListResponse,
    UpdateListRequest,
)

router = APIRouter(prefix="/internal/lists", tags=["internal-lists"])


@router.post("", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
def create_list(payload: CreateListRequest) -> ListResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id FROM lists
                WHERE owner_id = %s AND LOWER(name) = LOWER(%s)
                """,
                (str(payload.owner_id), payload.name),
            )
            existing = cursor.fetchone()
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="List with this name already exists",
                )

            cursor.execute(
                """
                INSERT INTO lists (owner_id, name, max_budget)
                VALUES (%s, %s, %s)
                RETURNING id, owner_id, name, max_budget, created_at
                """,
                (str(payload.owner_id), payload.name, payload.max_budget),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create list",
        )

    return ListResponse.model_validate(row)


@router.get("", response_model=list[ListResponse])
def get_lists_by_owner(owner_id: UUID = Query(...)) -> list[ListResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, owner_id, name, max_budget, created_at
                FROM lists
                WHERE owner_id = %s
                ORDER BY created_at DESC
                """,
                (str(owner_id),),
            )
            rows = cursor.fetchall()

    return [ListResponse.model_validate(row) for row in rows]


@router.get("/accessible", response_model=list[ListResponse])
def get_accessible_lists(user_id: UUID = Query(...)) -> list[ListResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT l.id, l.owner_id, l.name, l.max_budget, l.created_at
                FROM lists l
                LEFT JOIN list_members lm ON lm.list_id = l.id
                WHERE l.owner_id = %s OR lm.user_id = %s
                ORDER BY created_at DESC
                """,
                (str(user_id), str(user_id)),
            )
            rows = cursor.fetchall()

    return [ListResponse.model_validate(row) for row in rows]


@router.get("/{list_id}", response_model=BudgetListResponse)
def get_list(list_id: UUID = Path(...)) -> BudgetListResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, owner_id, name, max_budget, created_at
                FROM lists
                WHERE id = %s
                """,
                (str(list_id),),
            )
            row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    return BudgetListResponse.model_validate(row)


@router.patch("/{list_id}", response_model=ListResponse)
def update_list(
    payload: UpdateListRequest,
    list_id: UUID = Path(...),
) -> ListResponse:
    if payload.name is None and payload.max_budget is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update",
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            if payload.name is not None:
                cursor.execute(
                    """
                    SELECT id FROM lists
                    WHERE owner_id = %s AND LOWER(name) = LOWER(%s) AND id != %s
                    """,
                    (str(payload.owner_id), payload.name, str(list_id)),
                )
                existing = cursor.fetchone()
                if existing is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="List with this name already exists",
                    )

            cursor.execute(
                """
                UPDATE lists
                SET
                    name = COALESCE(%s, name),
                    max_budget = COALESCE(%s, max_budget)
                WHERE id = %s AND owner_id = %s
                RETURNING id, owner_id, name, max_budget, created_at
                """,
                (
                    payload.name,
                    payload.max_budget,
                    str(list_id),
                    str(payload.owner_id),
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    return ListResponse.model_validate(row)


@router.delete("/{list_id}", response_model=DeleteListResponse)
def delete_list(
    payload: DeleteListRequest,
    list_id: UUID = Path(...),
) -> DeleteListResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM lists
                WHERE id = %s AND owner_id = %s
                RETURNING id
                """,
                (str(list_id), str(payload.owner_id)),
            )
            row = cursor.fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    return DeleteListResponse(message="List deleted successfully")
