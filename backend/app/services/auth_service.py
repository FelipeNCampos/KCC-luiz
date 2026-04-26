from datetime import timedelta

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import TokenType, create_token, decode_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate


class AuthService:
    def __init__(self, db: Session) -> None:
        self.repository = UserRepository(db)

    def register(self, user_in: UserCreate) -> User:
        existing = self.repository.get_by_email(user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        return self.repository.create(user_in, hash_password(user_in.password))

    def authenticate(self, credentials: LoginRequest) -> User:
        user = self.repository.get_by_email(credentials.email)
        if not user or not verify_password(credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user",
            )
        return user

    def issue_tokens(self, user: User, response: Response) -> TokenResponse:
        access_expires = timedelta(minutes=settings.access_token_expire_minutes)
        refresh_expires = timedelta(days=settings.refresh_token_expire_days)
        access_token = create_token(str(user.id), TokenType.ACCESS, access_expires, user.role)
        refresh_token = create_token(str(user.id), TokenType.REFRESH, refresh_expires, user.role)

        response.set_cookie(
            key=settings.refresh_cookie_name,
            value=refresh_token,
            max_age=int(refresh_expires.total_seconds()),
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            path="/api/v1/auth",
        )

        return TokenResponse(
            access_token=access_token,
            expires_in=int(access_expires.total_seconds()),
            user=user,
        )

    def refresh(self, refresh_token: str | None, response: Response) -> TokenResponse:
        if not refresh_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

        payload = self._decode_expected_token(refresh_token, TokenType.REFRESH)
        user = self.repository.get_by_id(int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        return self.issue_tokens(user, response)

    def get_current_user_from_access_token(self, token: str) -> User:
        payload = self._decode_expected_token(token, TokenType.ACCESS)
        user = self.repository.get_by_id(int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user

    def clear_refresh_cookie(self, response: Response) -> None:
        response.delete_cookie(
            key=settings.refresh_cookie_name,
            path="/api/v1/auth",
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
        )

    @staticmethod
    def _decode_expected_token(token: str, expected_type: TokenType) -> dict:
        try:
            payload = decode_token(token)
            if payload.get("type") != expected_type.value:
                raise ValueError("Unexpected token type")
            if not payload.get("sub"):
                raise ValueError("Missing subject")
            return payload
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            ) from exc
