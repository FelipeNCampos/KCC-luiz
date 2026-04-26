from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, MessageResponse, TokenResponse
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, response: Response, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    service = AuthService(db)
    user = service.register(user_in)
    return service.issue_tokens(user, response)


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, response: Response, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    service = AuthService(db)
    user = service.authenticate(credentials)
    return service.issue_tokens(user, response)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias=settings.refresh_cookie_name)] = None,
) -> TokenResponse:
    return AuthService(db).refresh(refresh_token, response)


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response, db: Annotated[Session, Depends(get_db)]) -> MessageResponse:
    AuthService(db).clear_refresh_cookie(response)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserRead)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user
