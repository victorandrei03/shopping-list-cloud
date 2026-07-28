from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.notifications import router as notifications_router

app = FastAPI(title="Notification Service")

app.include_router(health_router)
app.include_router(notifications_router)
