from uuid import UUID

from pydantic import BaseModel


class AuthCredentials(BaseModel):
    email: str
    password: str


class ValidateTokenRequest(BaseModel):
    token: str


class UserPayload(BaseModel):
    id: UUID
    email: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserPayload


class ValidateTokenResponse(BaseModel):
    valid: bool
    user_id: UUID
    email: str


class IoUserResponse(BaseModel):
    id: UUID
    email: str
    password_hash: str
