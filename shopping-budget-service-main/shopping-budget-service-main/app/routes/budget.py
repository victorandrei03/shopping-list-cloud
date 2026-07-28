from uuid import UUID

from fastapi import APIRouter

from app.schemas import BudgetStatusResponse
from app.services import calculate_budget, recalculate_budget as recalculate_budget_service

router = APIRouter(prefix="/internal", tags=["budget"])


@router.get("/lists/{list_id}/budget", response_model=BudgetStatusResponse)
async def get_budget(list_id: UUID) -> BudgetStatusResponse:
    return await calculate_budget(list_id)


@router.post("/lists/{list_id}/budget/recalculate", response_model=BudgetStatusResponse)
async def recalculate_budget(list_id: UUID) -> BudgetStatusResponse:
    return await recalculate_budget_service(list_id)
