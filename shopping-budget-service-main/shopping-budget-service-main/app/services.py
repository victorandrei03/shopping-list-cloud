from decimal import Decimal
from uuid import UUID

from app.clients.io_service import get_items, get_list, get_list_recipients
from app.clients.notification_service import create_notification
from app.schemas import BudgetStatusResponse


def _compute_status(current_total: Decimal, max_budget: Decimal) -> str:
    if max_budget <= 0:
        return "over_budget" if current_total > 0 else "within_budget"
    if current_total > max_budget:
        return "over_budget"
    if current_total >= max_budget * Decimal("0.8"):
        return "near_limit"
    return "within_budget"


async def calculate_budget(list_id: UUID) -> BudgetStatusResponse:
    return await _calculate_budget(list_id, trigger_notifications=False)


async def recalculate_budget(list_id: UUID) -> BudgetStatusResponse:
    return await _calculate_budget(list_id, trigger_notifications=True)


async def _calculate_budget(list_id: UUID, trigger_notifications: bool) -> BudgetStatusResponse:
    list_data = await get_list(list_id)
    items = await get_items(list_id)

    current_total = sum(
        (item.estimated_price * item.quantity for item in items),
        start=Decimal("0"),
    )
    remaining_budget = list_data.max_budget - current_total
    status = _compute_status(current_total=current_total, max_budget=list_data.max_budget)

    budget = BudgetStatusResponse(
        list_id=list_data.id,
        max_budget=list_data.max_budget,
        current_total=current_total,
        remaining_budget=remaining_budget,
        status=status,
    )
    if trigger_notifications and status == "over_budget":
        recipients = await get_list_recipients(list_id)
        for recipient in recipients:
            await create_notification(
                user_id=recipient.user_id,
                list_id=list_id,
                message=f"Bugetul listei {list_data.name} a fost depasit.",
            )

    return budget
