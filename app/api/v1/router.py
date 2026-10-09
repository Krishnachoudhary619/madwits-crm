from fastapi import APIRouter

from app.api.v1 import (
    auth,
    customers,
    dashboard,
    jobs,
    payments,
    print_categories,
    users,
    workflow_stages,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(customers.router)
api_router.include_router(print_categories.router)
api_router.include_router(workflow_stages.router)
api_router.include_router(jobs.router)
api_router.include_router(payments.router)
api_router.include_router(dashboard.router)
