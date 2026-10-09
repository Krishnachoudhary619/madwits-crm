from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models import User
from app.schemas.user import (
    AttributionOption,
    StaffCreateRequest,
    UserListResponse,
    UserPublic,
    UserUpdateRequest,
)
from app.services.exceptions import LastAdminError, UsernameTakenError
from app.services.user_service import (
    create_staff,
    get_user_by_id,
    list_attribution_options,
    list_users,
    update_user,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/attribution-options", response_model=list[AttributionOption])
def attribution_options(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return list_attribution_options(db)


@router.get("", response_model=UserListResponse)
def list_directory(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> UserListResponse:
    items, total = list_users(db, page=page, page_size=page_size)
    return UserListResponse(
        items=[UserPublic.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_staff_account(
    payload: StaffCreateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    try:
        user = create_staff(
            db,
            username=payload.username,
            password=payload.password,
            display_name=payload.display_name,
        )
        db.commit()
        db.refresh(user)
        return user
    except UsernameTakenError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        ) from exc


@router.patch("/{user_id}", response_model=UserPublic)
def patch_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    try:
        updated = update_user(
            db,
            user,
            display_name=payload.display_name,
            password=payload.password,
            is_active=payload.is_active,
        )
        db.commit()
        db.refresh(updated)
        return updated
    except LastAdminError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        ) from exc
