from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.print_category import (
    PrintCategoryCreateRequest,
    PrintCategoryListResponse,
    PrintCategoryPublic,
    PrintCategoryUpdateRequest,
)
from app.schemas.workflow_stage import WorkflowStageCreateRequest, WorkflowStagePublic
from app.services.exceptions import (
    DuplicateActiveNameError,
    IncompleteWorkflowError,
    SequenceConflictError,
)
from app.services.workflow_service import (
    create_category,
    create_stage,
    get_category,
    list_categories,
    list_stages,
    update_category,
)

router = APIRouter(prefix="/print-categories", tags=["print-categories"])


def _conflict(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post(
    "", response_model=PrintCategoryPublic, status_code=status.HTTP_201_CREATED
)
def create(
    payload: PrintCategoryCreateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrintCategoryPublic:
    try:
        category = create_category(
            db,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
        )
        db.commit()
        db.refresh(category)
        return category
    except DuplicateActiveNameError as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.get("", response_model=PrintCategoryListResponse)
def list_directory(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> PrintCategoryListResponse:
    items, total = list_categories(
        db, is_active=is_active, page=page, page_size=page_size
    )
    return PrintCategoryListResponse(
        items=[PrintCategoryPublic.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{category_id}", response_model=PrintCategoryPublic)
def get_one(
    category_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrintCategoryPublic:
    category = get_category(db, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Print category not found.",
        )
    return category


@router.patch("/{category_id}", response_model=PrintCategoryPublic)
def patch(
    category_id: UUID,
    payload: PrintCategoryUpdateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrintCategoryPublic:
    category = get_category(db, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Print category not found.",
        )
    try:
        updated = update_category(
            db,
            category,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
        )
        db.commit()
        db.refresh(updated)
        return updated
    except (DuplicateActiveNameError, IncompleteWorkflowError) as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.get("/{category_id}/stages", response_model=list[WorkflowStagePublic])
def stages(
    category_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkflowStagePublic]:
    category = get_category(db, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Print category not found.",
        )
    return [WorkflowStagePublic.model_validate(item) for item in list_stages(db, category_id)]


@router.post(
    "/{category_id}/stages",
    response_model=WorkflowStagePublic,
    status_code=status.HTTP_201_CREATED,
)
def add_stage(
    category_id: UUID,
    payload: WorkflowStageCreateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowStagePublic:
    category = get_category(db, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Print category not found.",
        )
    try:
        stage = create_stage(
            db,
            category,
            name=payload.name,
            sequence=payload.sequence,
            is_initial=payload.is_initial,
            is_final=payload.is_final,
        )
        db.commit()
        db.refresh(stage)
        return stage
    except (
        DuplicateActiveNameError,
        IncompleteWorkflowError,
        SequenceConflictError,
    ) as exc:
        db.rollback()
        raise _conflict(exc) from exc
