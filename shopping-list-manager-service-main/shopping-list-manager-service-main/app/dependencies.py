from fastapi import Header, HTTPException, status

from app.clients.auth_service import validate_token
from app.schemas import ValidateTokenResponse


async def get_current_user(authorization: str = Header(...)) -> ValidateTokenResponse:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    return await validate_token(token)
