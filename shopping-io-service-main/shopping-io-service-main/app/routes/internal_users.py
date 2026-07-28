from fastapi import APIRouter, HTTPException, Query, status
from psycopg.errors import UniqueViolation

from app.db import get_connection
from app.schemas import CreateUserRequest, UserResponse

router = APIRouter(prefix="/internal/users", tags=["internal-users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: CreateUserRequest) -> UserResponse:
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO users (email, password_hash)
                    VALUES (%s, %s)
                    RETURNING id, email, password_hash, created_at
                    """,
                    (payload.email, payload.password_hash),
                )
                row = cursor.fetchone()
            connection.commit()
    except UniqueViolation as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        ) from exc

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

    return UserResponse.model_validate(row)


@router.get("/by-email", response_model=UserResponse)
def get_user_by_email(email: str = Query(...)) -> UserResponse:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, email, password_hash, created_at
                FROM users
                WHERE email = %s
                """,
                (email,),
            )
            row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(row)
