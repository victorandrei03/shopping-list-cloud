from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import (
    CommentActionResponse,
    CommentResponse,
    CreateCommentRequest,
    DeleteItemResponse,
    IoDeleteListResponse,
    IoListResponse,
    IoUserResponse,
    ItemResponse,
    ListMemberResponse,
    MembershipActionResponse,
    ShareListResponse,
    UpdateCommentRequest,
    VerifyListAccessResponse,
)


def _serialize_decimal(value: str | int | float | None) -> str | int | float | None:
    if value is None:
        return None
    return str(value)


async def get_user_by_email(email: str) -> IoUserResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get("/internal/users/by-email", params={"email": email})

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invited user was not found",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch user",
        )

    return IoUserResponse.model_validate(response.json())


async def create_list(owner_id: UUID, name: str, max_budget: str | int | float) -> IoListResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.post(
            "/internal/lists",
            json={
                "owner_id": str(owner_id),
                "name": name,
                "max_budget": _serialize_decimal(max_budget),
            },
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to create list",
        )

    return IoListResponse.model_validate(response.json())


async def get_lists(owner_id: UUID) -> list[IoListResponse]:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get("/internal/lists", params={"owner_id": str(owner_id)})

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch lists",
        )

    return [IoListResponse.model_validate(item) for item in response.json()]


async def get_accessible_lists(user_id: UUID) -> list[IoListResponse]:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get("/internal/lists/accessible", params={"user_id": str(user_id)})

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch accessible lists",
        )

    return [IoListResponse.model_validate(item) for item in response.json()]


async def update_list(
    list_id: UUID,
    owner_id: UUID,
    name: str | None,
    max_budget: str | int | float | None,
) -> IoListResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.patch(
            f"/internal/lists/{list_id}",
            json={
                "owner_id": str(owner_id),
                "name": name,
                "max_budget": _serialize_decimal(max_budget),
            },
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    if response.status_code == status.HTTP_400_BAD_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to update list",
        )

    return IoListResponse.model_validate(response.json())


async def delete_list(list_id: UUID, owner_id: UUID) -> IoDeleteListResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.request(
            "DELETE",
            f"/internal/lists/{list_id}",
            json={"owner_id": str(owner_id)},
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to delete list",
        )

    return IoDeleteListResponse.model_validate(response.json())


async def share_list(
    list_id: UUID,
    owner_id: UUID,
    user_id: UUID,
    user_email: str,
    role: str,
) -> ShareListResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.post(
            "/internal/list-members",
            json={
                "list_id": str(list_id),
                "owner_id": str(owner_id),
                "user_id": str(user_id),
                "user_email": user_email,
                "role": role,
            },
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    if response.status_code == status.HTTP_409_CONFLICT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this list",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to share list",
        )

    return ShareListResponse.model_validate(response.json())


async def get_list_members(list_id: UUID, requester_id: UUID) -> list[ListMemberResponse]:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get(
            f"/internal/list-members/by-list/{list_id}",
            params={"requester_id": str(requester_id)},
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    if response.status_code == status.HTTP_403_FORBIDDEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this list",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch list members",
        )

    return [ListMemberResponse.model_validate(item) for item in response.json()]


async def remove_list_member(list_id: UUID, owner_id: UUID, user_id: UUID) -> MembershipActionResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.delete(
            f"/internal/list-members/by-list/{list_id}/members/{user_id}",
            params={"owner_id": str(owner_id)},
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        detail = response.json().get("detail", "List member not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to remove list member",
        )

    return MembershipActionResponse.model_validate(response.json())


async def leave_list(list_id: UUID, requester_id: UUID) -> MembershipActionResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.delete(
            f"/internal/list-members/by-list/{list_id}/leave",
            params={"requester_id": str(requester_id)},
        )

    if response.status_code in {status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST}:
        detail = response.json().get("detail", "Unable to leave list")
        raise HTTPException(
            status_code=response.status_code,
            detail=detail,
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to leave list",
        )

    return MembershipActionResponse.model_validate(response.json())


async def verify_list_access(list_id: UUID, user_id: UUID) -> VerifyListAccessResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get(
            f"/internal/access/lists/{list_id}",
            params={"user_id": str(user_id)},
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    if response.status_code == status.HTTP_403_FORBIDDEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this list",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to verify list access",
        )

    return VerifyListAccessResponse.model_validate(response.json())


async def create_comment(
    list_id: UUID,
    user_id: UUID,
    content: str,
    x_percent: str | int | float,
    y_percent: str | int | float,
    width_percent: str | int | float,
    height_percent: str | int | float,
) -> CommentResponse:
    payload = CreateCommentRequest(
        content=content,
        x_percent=x_percent,
        y_percent=y_percent,
        width_percent=width_percent,
        height_percent=height_percent,
    )

    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.post(
            "/internal/comments",
            json={
                "list_id": str(list_id),
                "user_id": str(user_id),
                "content": payload.content,
                "x_percent": _serialize_decimal(payload.x_percent),
                "y_percent": _serialize_decimal(payload.y_percent),
                "width_percent": _serialize_decimal(payload.width_percent),
                "height_percent": _serialize_decimal(payload.height_percent),
            },
        )

    if response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid comment payload",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to create comment",
        )

    return CommentResponse.model_validate(response.json())


async def get_comments(list_id: UUID) -> list[CommentResponse]:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get(f"/internal/lists/{list_id}/comments")

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch comments",
        )

    return [CommentResponse.model_validate(item) for item in response.json()]


async def delete_comment(comment_id: UUID) -> CommentActionResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.delete(f"/internal/comments/{comment_id}")

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to delete comment",
        )

    return CommentActionResponse.model_validate(response.json())


async def update_comment(
    comment_id: UUID,
    content: str | None = None,
    x_percent: str | int | float | None = None,
    y_percent: str | int | float | None = None,
    width_percent: str | int | float | None = None,
    height_percent: str | int | float | None = None,
    user_id: UUID | None = None,
) -> CommentResponse:
    payload = UpdateCommentRequest(
        content=content,
        x_percent=x_percent,
        y_percent=y_percent,
        width_percent=width_percent,
        height_percent=height_percent,
    )

    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.patch(
            f"/internal/comments/{comment_id}",
            json={
                "content": payload.content,
                "x_percent": _serialize_decimal(payload.x_percent),
                "y_percent": _serialize_decimal(payload.y_percent),
                "width_percent": _serialize_decimal(payload.width_percent),
                "height_percent": _serialize_decimal(payload.height_percent),
                "user_id": str(user_id) if user_id is not None else None,
            },
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    if response.status_code == status.HTTP_400_BAD_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update",
        )

    if response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid comment payload",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to update comment",
        )

    return CommentResponse.model_validate(response.json())
