from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.db import get_connection
from app.schemas import VerifyListAccessResponse

router = APIRouter(prefix="/internal/access", tags=["internal-access"])


@router.get("/lists/{list_id}", response_model=VerifyListAccessResponse)
def verify_list_access(list_id: UUID, user_id: UUID = Query(...)) -> VerifyListAccessResponse:
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

            if str(list_row["owner_id"]) == str(user_id):
                return VerifyListAccessResponse(
                    list_id=list_id,
                    user_id=user_id,
                    role="owner",
                )

            cursor.execute(
                """
                SELECT role
                FROM list_members
                WHERE list_id = %s AND user_id = %s
                """,
                (str(list_id), str(user_id)),
            )
            membership_row = cursor.fetchone()

    if membership_row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this list",
        )

    return VerifyListAccessResponse(
        list_id=list_id,
        user_id=user_id,
        role=membership_row["role"],
    )
