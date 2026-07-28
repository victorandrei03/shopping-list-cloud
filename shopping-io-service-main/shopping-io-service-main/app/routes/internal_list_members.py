from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query, status
from psycopg.errors import UniqueViolation

from app.db import get_connection
from app.schemas import (
    ListMemberResponse,
    ListRecipientResponse,
    MembershipActionResponse,
    ShareListRequest,
    ShareListResponse,
)

router = APIRouter(prefix="/internal/list-members", tags=["internal-list-members"])


@router.post("", response_model=ShareListResponse, status_code=status.HTTP_201_CREATED)
def share_list(payload: ShareListRequest) -> ShareListResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id
                FROM lists
                WHERE id = %s AND owner_id = %s
                """,
                (str(payload.list_id), str(payload.owner_id)),
            )
            list_row = cursor.fetchone()

            if list_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="List not found",
                )

            try:
                cursor.execute(
                    """
                    INSERT INTO list_members (list_id, user_id, role)
                    VALUES (%s, %s, %s)
                    RETURNING list_id, role
                    """,
                    (
                        str(payload.list_id),
                        str(payload.user_id),
                        payload.role,
                    ),
                )
                membership_row = cursor.fetchone()
                connection.commit()
            except UniqueViolation as exc:
                connection.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User is already a member of this list",
                ) from exc

    if membership_row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to share list",
        )

    return ShareListResponse(
        list_id=payload.list_id,
        shared_with=payload.user_email,
        role=membership_row["role"],
    )


@router.get("/by-list/{list_id}", response_model=list[ListMemberResponse])
def get_list_members(
    list_id: UUID = Path(...),
    requester_id: UUID = Query(...),
) -> list[ListMemberResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, owner_id
                FROM lists
                WHERE id = %s
                """,
                (str(list_id),),
            )
            list_row = cursor.fetchone()

            if list_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="List not found",
                )

            if str(list_row["owner_id"]) != str(requester_id):
                cursor.execute(
                    """
                    SELECT id
                    FROM list_members
                    WHERE list_id = %s AND user_id = %s
                    """,
                    (str(list_id), str(requester_id)),
                )
                membership_row = cursor.fetchone()
                if membership_row is None:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You do not have access to this list",
                    )

            cursor.execute(
                """
                SELECT u.id AS user_id, u.email, 'owner' AS role, l.created_at
                FROM lists l
                JOIN users u ON u.id = l.owner_id
                WHERE l.id = %s
                UNION ALL
                SELECT u.id AS user_id, u.email, lm.role, lm.created_at
                FROM list_members lm
                JOIN users u ON u.id = lm.user_id
                WHERE lm.list_id = %s
                ORDER BY created_at ASC
                """,
                (str(list_id), str(list_id)),
            )
            rows = cursor.fetchall()

    return [ListMemberResponse.model_validate(row) for row in rows]


@router.get("/by-list/{list_id}/recipients", response_model=list[ListRecipientResponse])
def get_list_recipients(list_id: UUID = Path(...)) -> list[ListRecipientResponse]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.id AS user_id, u.email, 'owner' AS role
                FROM lists l
                JOIN users u ON u.id = l.owner_id
                WHERE l.id = %s
                UNION ALL
                SELECT u.id AS user_id, u.email, lm.role
                FROM list_members lm
                JOIN users u ON u.id = lm.user_id
                WHERE lm.list_id = %s
                ORDER BY email ASC
                """,
                (str(list_id), str(list_id)),
            )
            rows = cursor.fetchall()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    return [ListRecipientResponse.model_validate(row) for row in rows]


@router.delete("/by-list/{list_id}/members/{user_id}", response_model=MembershipActionResponse)
def remove_list_member(
    list_id: UUID = Path(...),
    user_id: UUID = Path(...),
    owner_id: UUID = Query(...),
) -> MembershipActionResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id
                FROM lists
                WHERE id = %s AND owner_id = %s
                """,
                (str(list_id), str(owner_id)),
            )
            list_row = cursor.fetchone()

            if list_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="List not found",
                )

            cursor.execute(
                """
                DELETE FROM list_members
                WHERE list_id = %s AND user_id = %s
                RETURNING user_id
                """,
                (str(list_id), str(user_id)),
            )
            removed_row = cursor.fetchone()
            connection.commit()

    if removed_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List member not found",
        )

    return MembershipActionResponse(message="Member removed from list")


@router.delete("/by-list/{list_id}/leave", response_model=MembershipActionResponse)
def leave_list(
    list_id: UUID = Path(...),
    requester_id: UUID = Query(...),
) -> MembershipActionResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT owner_id
                FROM lists
                WHERE id = %s
                """,
                (str(list_id),),
            )
            list_row = cursor.fetchone()

            if list_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="List not found",
                )

            if str(list_row["owner_id"]) == str(requester_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Owner cannot leave their own list",
                )

            cursor.execute(
                """
                DELETE FROM list_members
                WHERE list_id = %s AND user_id = %s
                RETURNING user_id
                """,
                (str(list_id), str(requester_id)),
            )
            deleted_row = cursor.fetchone()
            connection.commit()

    if deleted_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this list",
        )

    return MembershipActionResponse(message="You left the list")
