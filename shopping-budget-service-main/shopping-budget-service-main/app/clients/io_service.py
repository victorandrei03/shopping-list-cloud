from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import BudgetListResponse, ItemResponse, ListRecipientResponse


async def get_list(list_id: UUID) -> BudgetListResponse:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get(f"/internal/lists/{list_id}")

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch list",
        )

    return BudgetListResponse.model_validate(response.json())


async def get_items(list_id: UUID) -> list[ItemResponse]:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get("/internal/items", params={"list_id": str(list_id)})

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch items",
        )

    return [ItemResponse.model_validate(item) for item in response.json()]


async def get_list_recipients(list_id: UUID) -> list[ListRecipientResponse]:
    async with httpx.AsyncClient(base_url=settings.io_service_url, timeout=10.0) as client:
        response = await client.get(f"/internal/list-members/by-list/{list_id}/recipients")

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IO service failed to fetch list recipients",
        )

    return [ListRecipientResponse.model_validate(item) for item in response.json()]
