from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services.user_service import get_user_by_username

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = get_user_by_username(db, payload.username.strip())
    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_current_user: User = Depends(get_current_user)) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserPublic)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
