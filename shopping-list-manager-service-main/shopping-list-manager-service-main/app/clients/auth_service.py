import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import ValidateTokenResponse


async def validate_token(token: str) -> ValidateTokenResponse:
    async with httpx.AsyncClient(base_url=settings.auth_service_url, timeout=10.0) as client:
        response = await client.post("/auth/validate", json={"token": token})

    if response.status_code == status.HTTP_401_UNAUTHORIZED:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Auth service failed to validate token",
        )

    return ValidateTokenResponse.model_validate(response.json())
