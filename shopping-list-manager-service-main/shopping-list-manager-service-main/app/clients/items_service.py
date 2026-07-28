from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import BulkCheckItemsResponse, DeleteItemResponse, ItemResponse, SpendingAnalysisResponse


def _serialize_decimal(value: str | int | float | None) -> str | int | float | None:
    if value is None:
        return None
    return str(value)


async def create_item(
    list_id: UUID,
    name: str,
    quantity: int,
    estimated_price: str | int | float,
    actor_user_id: UUID,
    actor_email: str,
) -> ItemResponse:
    async with httpx.AsyncClient(base_url=settings.items_service_url, timeout=10.0) as client:
        response = await client.post(
            f"/internal/lists/{list_id}/items",
            headers={
                "X-User-Id": str(actor_user_id),
                "X-User-Email": actor_email,
            },
            json={
                "name": name,
                "quantity": quantity,
                "estimated_price": _serialize_decimal(estimated_price),
            },
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Items service failed to create item",
        )

    return ItemResponse.model_validate(response.json())


async def get_items(list_id: UUID) -> list[ItemResponse]:
    async with httpx.AsyncClient(base_url=settings.items_service_url, timeout=10.0) as client:
        response = await client.get(f"/internal/lists/{list_id}/items")

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Items service failed to fetch items",
        )

    return [ItemResponse.model_validate(item) for item in response.json()]


async def update_item(
    list_id: UUID,
    item_id: UUID,
    name: str | None,
    quantity: int | None,
    estimated_price: str | int | float | None,
    checked: bool | None,
    actor_user_id: UUID,
    actor_email: str,
) -> ItemResponse:
    async with httpx.AsyncClient(base_url=settings.items_service_url, timeout=10.0) as client:
        response = await client.patch(
            f"/internal/lists/{list_id}/items/{item_id}",
            headers={
                "X-User-Id": str(actor_user_id),
                "X-User-Email": actor_email,
            },
            json={
                "name": name,
                "quantity": quantity,
                "estimated_price": _serialize_decimal(estimated_price),
                "checked": checked,
            },
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    if response.status_code == status.HTTP_400_BAD_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Items service failed to update item",
        )

    return ItemResponse.model_validate(response.json())


async def delete_item(list_id: UUID, item_id: UUID) -> DeleteItemResponse:
    async with httpx.AsyncClient(base_url=settings.items_service_url, timeout=10.0) as client:
        response = await client.delete(f"/internal/lists/{list_id}/items/{item_id}")

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Items service failed to delete item",
        )

    return DeleteItemResponse.model_validate(response.json())


async def bulk_check_items(
    list_id: UUID,
    checked: bool,
    actor_user_id: UUID,
    actor_email: str,
) -> BulkCheckItemsResponse:
    async with httpx.AsyncClient(base_url=settings.items_service_url, timeout=10.0) as client:
        response = await client.post(
            f"/internal/lists/{list_id}/items/bulk-check",
            headers={
                "X-User-Id": str(actor_user_id),
                "X-User-Email": actor_email,
            },
            params={
                "checked": str(checked).lower(),
            },
        )

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Items service failed to update items in bulk",
        )

    return BulkCheckItemsResponse.model_validate(response.json())


async def get_spending_analysis(list_id: UUID) -> SpendingAnalysisResponse:
    async with httpx.AsyncClient(base_url=settings.items_service_url, timeout=10.0) as client:
        response = await client.get(f"/internal/lists/{list_id}/items/spending-analysis")

    if response.is_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Items service failed to fetch spending analysis",
        )

    return SpendingAnalysisResponse.model_validate(response.json())
