from fastapi import APIRouter

from app.api.v1.routers import auth, cashflow, oakhill, tasks, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(cashflow.router, prefix="/cashflow", tags=["cashflow"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(oakhill.router, tags=["oakhill"])
