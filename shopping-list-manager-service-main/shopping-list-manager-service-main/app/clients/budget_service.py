from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas import BudgetStatusResponse


async def get_budget(list_id: UUID) -> BudgetStatusResponse:
    async with httpx.AsyncClient(base_url=settings.budget_service_url, timeout=10.0) as client:
        response = await client.get(f"/internal/lists/{list_id}/budget")

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(status_code=404, detail="List not found")

    if response.is_error:
        raise HTTPException(status_code=502, detail="Budget service failed to fetch budget")

    return BudgetStatusResponse.model_validate(response.json())


async def recalculate_budget(list_id: UUID) -> BudgetStatusResponse:
    async with httpx.AsyncClient(base_url=settings.budget_service_url, timeout=10.0) as client:
        response = await client.post(f"/internal/lists/{list_id}/budget/recalculate")

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(status_code=404, detail="List not found")

    if response.is_error:
        raise HTTPException(status_code=502, detail="Budget service failed to recalculate budget")

    return BudgetStatusResponse.model_validate(response.json())
