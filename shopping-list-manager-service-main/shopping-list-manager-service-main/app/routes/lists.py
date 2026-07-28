from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime

from app.clients.budget_service import get_budget, recalculate_budget
from app.clients.io_service import (
    create_comment,
    get_accessible_lists,
    get_comments,
    create_list,
    delete_comment,
    delete_list,
    get_list_members,
    get_lists,
    get_user_by_email,
    leave_list,
    remove_list_member,
    share_list,
    update_list,
    update_comment,
    verify_list_access,
)
from app.clients.items_service import (
    bulk_check_items,
    create_item,
    delete_item,
    get_items,
    get_spending_analysis,
    update_item,
)
from app.clients.notification_service import create_notification, get_notifications, mark_notification_as_read
from app.dependencies import get_current_user
from app.schemas import (
    CreateItemRequest,
    CreateListRequest,
    BudgetStatusResponse,
    BulkCheckItemsResponse,
    CommentActionResponse,
    CommentResponse,
    CreateCommentRequest,
    UpdateCommentRequest,
    DeleteItemResponse,
    DeleteListResponse,
    ItemResponse,
    ListResponse,
    ListMemberResponse,
    MembershipActionResponse,
    NotificationResponse,
    ShareListRequest,
    ShareListResponse,
    SpendingAnalysisResponse,
    UpdateItemRequest,
    UpdateBudgetRequest,
    UpdateListRequest,
    ValidateTokenResponse,
)

router = APIRouter(tags=["lists"])


@router.post("/lists", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
async def create_list_endpoint(
    payload: CreateListRequest,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> ListResponse:
    created = await create_list(current_user.user_id, payload.name, payload.max_budget)
    return ListResponse.model_validate(created.model_dump())


@router.get("/lists", response_model=list[ListResponse])
async def get_lists_endpoint(
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> list[ListResponse]:
    items = await get_lists(current_user.user_id)
    return [ListResponse.model_validate(item.model_dump()) for item in items]


@router.get("/lists/accessible", response_model=list[ListResponse])
async def get_accessible_lists_endpoint(
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> list[ListResponse]:
    items = await get_accessible_lists(current_user.user_id)
    return [ListResponse.model_validate(item.model_dump()) for item in items]


@router.patch("/lists/{list_id}", response_model=ListResponse)
async def update_list_endpoint(
    payload: UpdateListRequest,
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> ListResponse:
    updated = await update_list(
        list_id=list_id,
        owner_id=current_user.user_id,
        name=payload.name,
        max_budget=payload.max_budget,
    )
    return ListResponse.model_validate(updated.model_dump())


@router.delete("/lists/{list_id}", response_model=DeleteListResponse)
async def delete_list_endpoint(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> DeleteListResponse:
    deleted = await delete_list(list_id=list_id, owner_id=current_user.user_id)
    return DeleteListResponse.model_validate(deleted.model_dump())


@router.post("/lists/{list_id}/share", response_model=ShareListResponse)
async def share_list_endpoint(
    payload: ShareListRequest,
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> ShareListResponse:
    invited_user = await get_user_by_email(payload.user_email)
    shared = await share_list(
        list_id=list_id,
        owner_id=current_user.user_id,
        user_id=invited_user.id,
        user_email=invited_user.email,
        role=payload.role,
    )
    await create_notification(
        user_id=invited_user.id,
        list_id=list_id,
        message=f"Lista a fost partajata cu tine de {current_user.email}.",
    )
    return ShareListResponse.model_validate(shared.model_dump())


@router.get("/lists/{list_id}/members", response_model=list[ListMemberResponse])
async def get_list_members_endpoint(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> list[ListMemberResponse]:
    members = await get_list_members(list_id=list_id, requester_id=current_user.user_id)
    return [ListMemberResponse.model_validate(item.model_dump()) for item in members]


@router.delete("/lists/{list_id}/members/{user_id}", response_model=MembershipActionResponse)
async def remove_list_member_endpoint(
    list_id: UUID,
    user_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> MembershipActionResponse:
    removed = await remove_list_member(
        list_id=list_id,
        owner_id=current_user.user_id,
        user_id=user_id,
    )
    return MembershipActionResponse.model_validate(removed.model_dump())


@router.delete("/lists/{list_id}/leave", response_model=MembershipActionResponse)
async def leave_list_endpoint(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> MembershipActionResponse:
    left = await leave_list(
        list_id=list_id,
        requester_id=current_user.user_id,
    )
    return MembershipActionResponse.model_validate(left.model_dump())


@router.post("/lists/{list_id}/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item_endpoint(
    payload: CreateItemRequest,
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> ItemResponse:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    created = await create_item(
        list_id=list_id,
        name=payload.name,
        quantity=payload.quantity,
        estimated_price=payload.estimated_price,
        actor_user_id=current_user.user_id,
        actor_email=current_user.email,
    )
    return ItemResponse.model_validate(created.model_dump())


@router.get("/lists/{list_id}/items", response_model=list[ItemResponse])
async def get_items_endpoint(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> list[ItemResponse]:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    items = await get_items(list_id=list_id)
    return [ItemResponse.model_validate(item.model_dump()) for item in items]


@router.patch("/lists/{list_id}/items/{item_id}", response_model=ItemResponse)
async def update_item_endpoint(
    payload: UpdateItemRequest,
    list_id: UUID,
    item_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> ItemResponse:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    updated = await update_item(
        list_id=list_id,
        item_id=item_id,
        name=payload.name,
        quantity=payload.quantity,
        estimated_price=payload.estimated_price,
        checked=payload.checked,
        actor_user_id=current_user.user_id,
        actor_email=current_user.email,
    )
    return ItemResponse.model_validate(updated.model_dump())


@router.delete("/lists/{list_id}/items/{item_id}", response_model=DeleteItemResponse)
async def delete_item_endpoint(
    list_id: UUID,
    item_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> DeleteItemResponse:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    deleted = await delete_item(list_id=list_id, item_id=item_id)
    return DeleteItemResponse.model_validate(deleted.model_dump())


@router.post("/lists/{list_id}/items/bulk-check", response_model=BulkCheckItemsResponse)
async def bulk_check_items_endpoint(
    list_id: UUID,
    checked: bool = True,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> BulkCheckItemsResponse:
    access = await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    if access.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer cannot modify items in this list",
        )

    result = await bulk_check_items(
        list_id=list_id,
        checked=checked,
        actor_user_id=current_user.user_id,
        actor_email=current_user.email,
    )
    return BulkCheckItemsResponse.model_validate(result.model_dump())


@router.get("/lists/{list_id}/budget", response_model=BudgetStatusResponse)
async def get_budget_endpoint(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> BudgetStatusResponse:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    budget = await get_budget(list_id)
    return BudgetStatusResponse.model_validate(budget.model_dump())


@router.get("/lists/{list_id}/spending-analysis", response_model=SpendingAnalysisResponse)
async def get_spending_analysis_endpoint(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> SpendingAnalysisResponse:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    analysis = await get_spending_analysis(list_id)
    return SpendingAnalysisResponse.model_validate(analysis.model_dump())


@router.post("/lists/{list_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment_endpoint(
    payload: CreateCommentRequest,
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> CommentResponse:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    created = await create_comment(
        list_id=list_id,
        user_id=current_user.user_id,
        content=payload.content,
        x_percent=payload.x_percent,
        y_percent=payload.y_percent,
        width_percent=payload.width_percent,
        height_percent=payload.height_percent,
    )
    return CommentResponse.model_validate(created.model_dump())


@router.get("/lists/{list_id}/comments", response_model=list[CommentResponse])
async def get_comments_endpoint(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> list[CommentResponse]:
    await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    comments = await get_comments(list_id=list_id)
    return [CommentResponse.model_validate(item.model_dump()) for item in comments]


@router.delete("/lists/{list_id}/comments/{comment_id}", response_model=CommentActionResponse)
async def delete_comment_endpoint(
    list_id: UUID,
    comment_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> CommentActionResponse:
    access = await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    comments = await get_comments(list_id=list_id)
    matched_comment = next((comment for comment in comments if comment.id == comment_id), None)
    if matched_comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )
    # allow delete if user is author OR has owner/editor role on the list
    is_author = matched_comment.user_id == current_user.user_id
    can_edit = access.role in ("owner", "editor")
    if not is_author and not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this comment",
        )

    deleted = await delete_comment(comment_id=comment_id)
    return CommentActionResponse.model_validate(deleted.model_dump())


@router.patch("/lists/{list_id}/comments/{comment_id}", response_model=CommentResponse)
async def update_comment_endpoint(
    payload: UpdateCommentRequest,
    list_id: UUID,
    comment_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> CommentResponse:
    access = await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    comments = await get_comments(list_id=list_id)
    matched_comment = next((comment for comment in comments if comment.id == comment_id), None)
    if matched_comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )
    # allow update if user is author OR has owner/editor role on the list
    is_author = matched_comment.user_id == current_user.user_id
    can_edit = access.role in ("owner", "editor")
    if not is_author and not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this comment",
        )

    updated = await update_comment(
        comment_id=comment_id,
        content=payload.content,
        x_percent=payload.x_percent,
        y_percent=payload.y_percent,
        width_percent=payload.width_percent,
        height_percent=payload.height_percent,
        user_id=payload.user_id if hasattr(payload, 'user_id') else None,
    )
    return CommentResponse.model_validate(updated.model_dump())


@router.get("/notifications", response_model=list[NotificationResponse])
async def get_notifications_endpoint(
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> list[NotificationResponse]:
    notifications = await get_notifications(current_user.user_id)
    return [NotificationResponse.model_validate(item.model_dump()) for item in notifications]


@router.patch("/notifications/{notification_id}", response_model=NotificationResponse)
async def mark_notification_read_endpoint(
    notification_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> NotificationResponse:
    notification = await mark_notification_as_read(notification_id)
    return NotificationResponse.model_validate(notification.model_dump())


@router.patch("/lists/{list_id}/budget", response_model=BudgetStatusResponse)
async def update_budget_endpoint(
    payload: UpdateBudgetRequest,
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> BudgetStatusResponse:
    await update_list(
        list_id=list_id,
        owner_id=current_user.user_id,
        name=None,
        max_budget=payload.max_budget,
    )
    budget = await recalculate_budget(list_id)
    return BudgetStatusResponse.model_validate(budget.model_dump())


@router.get("/lists/summary", response_model=dict)
async def get_lists_summary(
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> dict:

    items = await get_lists(current_user.user_id)
    total_lists = len(items)
    total_budget = sum(item.max_budget for item in items)
    
    return {
        "user_id": current_user.user_id,
        "total_active_lists": total_lists,
        "combined_max_budget": total_budget,
        "timestamp": datetime.now()
    }

@router.get("/lists/search", response_model=list[ListResponse])
async def search_lists_by_name(
    query: str,
    current_user: ValidateTokenResponse = Depends(get_current_user),
) -> list[ListResponse]:

    all_lists = await get_lists(current_user.user_id)
    filtered = [l for l in all_lists if query.lower() in l.name.lower()]
    return [ListResponse.model_validate(item.model_dump()) for item in filtered]

@router.get("/lists/{list_id}/audit", tags=["audit"])
async def get_list_audit_log(
    list_id: UUID,
    current_user: ValidateTokenResponse = Depends(get_current_user),
):

    access = await verify_list_access(list_id=list_id, user_id=current_user.user_id)
    return {
        "list_id": list_id,
        "requester": current_user.email,
        "role_at_access": access.role,
        "access_granted": True,
        "audit_status": "logging_enabled"
    }

# ----------------------------------------
