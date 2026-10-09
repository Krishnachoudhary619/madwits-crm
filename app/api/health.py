import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db.session import check_database_connection

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def readiness() -> JSONResponse:
    try:
        check_database_connection()
    except Exception:
        logger.warning("Database readiness check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": "not_ready"},
        )
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "database": "ready"},
    )
