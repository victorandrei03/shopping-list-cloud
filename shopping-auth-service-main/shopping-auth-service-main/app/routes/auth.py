from fastapi import APIRouter, HTTPException, status

from app.clients.io_service import create_user, get_user_by_email
from app.schemas import (
    AuthCredentials,
    LoginResponse,
    UserPayload,
    ValidateTokenRequest,
    ValidateTokenResponse,
)
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPayload, status_code=status.HTTP_201_CREATED)
async def register(payload: AuthCredentials) -> UserPayload:
    user = await create_user(payload.email, hash_password(payload.password))
    return UserPayload(id=user.id, email=user.email)


@router.post("/login", response_model=LoginResponse)
async def login(payload: AuthCredentials) -> LoginResponse:
    user = await get_user_by_email(payload.email)
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user.id), user.email)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPayload(id=user.id, email=user.email),
    )


@router.post("/validate", response_model=ValidateTokenResponse)
async def validate_token(payload: ValidateTokenRequest) -> ValidateTokenResponse:
    try:
        decoded = decode_access_token(payload.token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    return ValidateTokenResponse(
        valid=True,
        user_id=decoded["sub"],
        email=decoded["email"],
    )
