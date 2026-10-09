from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.workflow_stage import WorkflowStagePublic, WorkflowStageUpdateRequest
from app.services.exceptions import (
    DuplicateActiveNameError,
    IncompleteWorkflowError,
    SequenceConflictError,
)
from app.services.workflow_service import deactivate_stage, get_stage, update_stage

router = APIRouter(prefix="/workflow-stages", tags=["workflow-stages"])


def _conflict(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.patch("/{stage_id}", response_model=WorkflowStagePublic)
def patch(
    stage_id: UUID,
    payload: WorkflowStageUpdateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowStagePublic:
    stage = get_stage(db, stage_id)
    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found."
        )
    try:
        updated = update_stage(
            db,
            stage,
            name=payload.name,
            sequence=payload.sequence,
            is_initial=payload.is_initial,
            is_final=payload.is_final,
            is_active=payload.is_active,
        )
        db.commit()
        db.refresh(updated)
        return updated
    except (
        DuplicateActiveNameError,
        IncompleteWorkflowError,
        SequenceConflictError,
    ) as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.post("/{stage_id}/deactivate", response_model=WorkflowStagePublic)
def deactivate(
    stage_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowStagePublic:
    stage = get_stage(db, stage_id)
    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found."
        )
    try:
        updated = deactivate_stage(db, stage)
        db.commit()
        db.refresh(updated)
        return updated
    except IncompleteWorkflowError as exc:
        db.rollback()
        raise _conflict(exc) from exc
