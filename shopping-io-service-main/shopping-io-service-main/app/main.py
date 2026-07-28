from fastapi import FastAPI

from app.db import ensure_annotations_schema
from app.routes.health import router as health_router
from app.routes.internal_access import router as internal_access_router
from app.routes.internal_comments import router as internal_comments_router
from app.routes.internal_list_members import router as internal_list_members_router
from app.routes.internal_lists import router as internal_lists_router
from app.routes.internal_items import router as internal_items_router
from app.routes.internal_notifications import router as internal_notifications_router
from app.routes.internal_users import router as internal_users_router

app = FastAPI(title="IO Service")


@app.on_event("startup")
def startup() -> None:
    ensure_annotations_schema()

app.include_router(health_router)
app.include_router(internal_access_router)
app.include_router(internal_comments_router)
app.include_router(internal_list_members_router)
app.include_router(internal_lists_router)
app.include_router(internal_items_router)
app.include_router(internal_notifications_router)
app.include_router(internal_users_router)
