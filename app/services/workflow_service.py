from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import PrintCategory, WorkflowStage
from app.services.exceptions import (
    DuplicateActiveNameError,
    IncompleteWorkflowError,
    SequenceConflictError,
)


def get_category(db: Session, category_id: UUID) -> PrintCategory | None:
    return db.get(PrintCategory, category_id)


def get_stage(db: Session, stage_id: UUID) -> WorkflowStage | None:
    return db.get(WorkflowStage, stage_id)


def list_active_stages(db: Session, category_id: UUID) -> list[WorkflowStage]:
    return list(
        db.scalars(
            select(WorkflowStage)
            .where(
                WorkflowStage.category_id == category_id,
                WorkflowStage.is_active.is_(True),
            )
            .order_by(WorkflowStage.sequence.asc())
        ).all()
    )


def ensure_active_workflow(db: Session, category: PrintCategory) -> None:
    if not category.is_active:
        return
    stages = list_active_stages(db, category.id)
    if not stages:
        return
    initials = [stage for stage in stages if stage.is_initial]
    finals = [stage for stage in stages if stage.is_final]
    if len(initials) != 1 or len(finals) != 1:
        raise IncompleteWorkflowError(
            "An active category must have exactly one active initial stage "
            "and one active final stage."
        )


def require_complete_workflow_to_activate(
    db: Session, category: PrintCategory
) -> None:
    stages = list_active_stages(db, category.id)
    initials = [stage for stage in stages if stage.is_initial]
    finals = [stage for stage in stages if stage.is_final]
    if not stages or len(initials) != 1 or len(finals) != 1:
        raise IncompleteWorkflowError(
            "A category can be activated only when it has exactly one active "
            "initial stage and one active final stage."
        )


def next_sequence(db: Session, category_id: UUID) -> int:
    current = db.scalar(
        select(func.max(WorkflowStage.sequence)).where(
            WorkflowStage.category_id == category_id
        )
    )
    return int(current or 0) + 1


def _clear_flag(
    db: Session, category_id: UUID, *, flag: str, except_id: UUID
) -> None:
    stages = list_active_stages(db, category_id)
    for stage in stages:
        if stage.id != except_id and getattr(stage, flag):
            setattr(stage, flag, False)
    db.flush()


def _stage_by_sequence(
    db: Session, category_id: UUID, sequence: int, except_id: UUID | None = None
) -> WorkflowStage | None:
    stmt = select(WorkflowStage).where(
        WorkflowStage.category_id == category_id,
        WorkflowStage.sequence == sequence,
    )
    if except_id is not None:
        stmt = stmt.where(WorkflowStage.id != except_id)
    return db.scalar(stmt)


def assign_sequence(db: Session, stage: WorkflowStage, sequence: int) -> None:
    occupant = _stage_by_sequence(
        db, stage.category_id, sequence, except_id=stage.id
    )
    if occupant is None:
        stage.sequence = sequence
        return
    db.execute(text("SET CONSTRAINTS uq_workflow_stages_category_sequence DEFERRED"))
    occupant.sequence, stage.sequence = stage.sequence, sequence


def create_category(
    db: Session,
    *,
    name: str,
    description: str | None = None,
    is_active: bool = True,
) -> PrintCategory:
    category = PrintCategory(
        name=name.strip(),
        description=description.strip() if description else None,
        is_active=is_active,
    )
    db.add(category)
    try:
        db.flush()
    except IntegrityError as exc:
        raise DuplicateActiveNameError(
            "An active print category with this name already exists."
        ) from exc
    db.refresh(category)
    return category


def list_categories(
    db: Session,
    *,
    is_active: bool | None,
    page: int,
    page_size: int,
) -> tuple[list[PrintCategory], int]:
    stmt = select(PrintCategory)
    count_stmt = select(func.count()).select_from(PrintCategory)
    if is_active is not None:
        stmt = stmt.where(PrintCategory.is_active.is_(is_active))
        count_stmt = count_stmt.where(PrintCategory.is_active.is_(is_active))
    total = int(db.scalar(count_stmt) or 0)
    items = list(
        db.scalars(
            stmt.order_by(PrintCategory.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, total


def update_category(
    db: Session,
    category: PrintCategory,
    *,
    name: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> PrintCategory:
    if name is not None:
        category.name = name.strip()
    if description is not None:
        category.description = description.strip() or None
    activating = is_active is True and not category.is_active
    if is_active is not None:
        category.is_active = is_active
    try:
        db.flush()
    except IntegrityError as exc:
        raise DuplicateActiveNameError(
            "An active print category with this name already exists."
        ) from exc
    if activating:
        require_complete_workflow_to_activate(db, category)
    elif category.is_active:
        ensure_active_workflow(db, category)
    db.refresh(category)
    return category


def list_stages(db: Session, category_id: UUID) -> list[WorkflowStage]:
    return list(
        db.scalars(
            select(WorkflowStage)
            .where(WorkflowStage.category_id == category_id)
            .order_by(WorkflowStage.sequence.asc(), WorkflowStage.name.asc())
        ).all()
    )


def create_stage(
    db: Session,
    category: PrintCategory,
    *,
    name: str,
    sequence: int | None,
    is_initial: bool,
    is_final: bool,
) -> WorkflowStage:
    stage = WorkflowStage(
        category_id=category.id,
        name=name.strip(),
        sequence=sequence or next_sequence(db, category.id),
        is_initial=is_initial,
        is_final=is_final,
    )
    if _stage_by_sequence(db, category.id, stage.sequence) is not None:
        raise SequenceConflictError(
            "Another stage already uses this sequence in the category."
        )
    db.add(stage)
    db.flush()
    if is_initial:
        _clear_flag(db, category.id, flag="is_initial", except_id=stage.id)
        stage.is_initial = True
    if is_final:
        _clear_flag(db, category.id, flag="is_final", except_id=stage.id)
        stage.is_final = True
    try:
        db.flush()
    except IntegrityError as exc:
        raise DuplicateActiveNameError(
            "An active stage with this name already exists in the category."
        ) from exc
    ensure_active_workflow(db, category)
    db.refresh(stage)
    return stage


def update_stage(
    db: Session,
    stage: WorkflowStage,
    *,
    name: str | None = None,
    sequence: int | None = None,
    is_initial: bool | None = None,
    is_final: bool | None = None,
    is_active: bool | None = None,
) -> WorkflowStage:
    category = get_category(db, stage.category_id)
    if category is None:
        raise IncompleteWorkflowError("Print category not found.")
    if name is not None:
        stage.name = name.strip()
    if sequence is not None:
        assign_sequence(db, stage, sequence)
    if is_active is not None:
        stage.is_active = is_active
    db.flush()
    if is_initial is True:
        _clear_flag(db, stage.category_id, flag="is_initial", except_id=stage.id)
        stage.is_initial = True
    elif is_initial is False:
        stage.is_initial = False
    if is_final is True:
        _clear_flag(db, stage.category_id, flag="is_final", except_id=stage.id)
        stage.is_final = True
    elif is_final is False:
        stage.is_final = False
    try:
        db.flush()
    except IntegrityError as exc:
        raise DuplicateActiveNameError(
            "An active stage with this name already exists in the category."
        ) from exc
    ensure_active_workflow(db, category)
    db.refresh(stage)
    return stage


def deactivate_stage(db: Session, stage: WorkflowStage) -> WorkflowStage:
    return update_stage(db, stage, is_active=False)
