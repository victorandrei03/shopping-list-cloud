from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.budget import router as budget_router

# CI/CD test change
app = FastAPI(title="Budget Service")

app.include_router(health_router)
app.include_router(budget_router)
