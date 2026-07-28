import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import IoUserResponse


async def create_user(email: str, password_hash: str) -> IoUserResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.post(
            "/internal/users",
            json={"email": email, "password_hash": password_hash},
        )

    if response.status_code == status.HTTP_409_CONFLICT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to create user",
        )

    return IoUserResponse.model_validate(response.json())


async def get_user_by_email(email: str) -> IoUserResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get("/internal/users/by-email", params={"email": email})

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch user",
        )

    return IoUserResponse.model_validate(response.json())
