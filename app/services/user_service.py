from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User, UserRole
from app.services.exceptions import (
    AdminAlreadyExistsError,
    AttributionUserNotFoundError,
    InactiveAttributionUserError,
    LastAdminError,
    UsernameTakenError,
)


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def count_admins(db: Session, *, active_only: bool = False) -> int:
    query = select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)
    if active_only:
        query = query.where(User.is_active.is_(True))
    return int(db.scalar(query) or 0)


def provision_initial_admin(
    db: Session,
    *,
    username: str,
    password: str,
    display_name: str,
) -> User:
    if count_admins(db) > 0:
        raise AdminAlreadyExistsError("An Admin account already exists.")
    if get_user_by_username(db, username) is not None:
        raise UsernameTakenError("That username is already taken.")
    user = User(
        display_name=display_name.strip(),
        username=username.strip(),
        password_hash=hash_password(password),
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def create_staff(
    db: Session,
    *,
    username: str,
    password: str,
    display_name: str,
) -> User:
    username = username.strip()
    if get_user_by_username(db, username) is not None:
        raise UsernameTakenError("That username is already taken.")
    user = User(
        display_name=display_name.strip(),
        username=username,
        password_hash=hash_password(password),
        role=UserRole.STAFF.value,
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def list_users(db: Session, *, page: int, page_size: int) -> tuple[list[User], int]:
    total = int(db.scalar(select(func.count()).select_from(User)) or 0)
    items = list(
        db.scalars(
            select(User)
            .order_by(User.created_at.asc(), User.username.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, total


def list_attribution_options(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.is_active.is_(True))
            .order_by(User.display_name.asc(), User.username.asc())
        ).all()
    )


def update_user(
    db: Session,
    user: User,
    *,
    display_name: str | None = None,
    password: str | None = None,
    is_active: bool | None = None,
) -> User:
    if is_active is False and user.role == UserRole.ADMIN.value:
        if user.is_active and count_admins(db, active_only=True) <= 1:
            raise LastAdminError("The last active Admin cannot be deactivated.")
    if display_name is not None:
        user.display_name = display_name.strip()
    if password is not None:
        user.password_hash = hash_password(password)
    if is_active is not None:
        user.is_active = is_active
    db.flush()
    db.refresh(user)
    return user


def require_active_attribution_user(db: Session, user_id: UUID) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise AttributionUserNotFoundError("The selected attribution user was not found.")
    if not user.is_active:
        raise InactiveAttributionUserError(
            "The selected attribution user is not active."
        )
    return user
