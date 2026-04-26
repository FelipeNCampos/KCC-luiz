from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email.lower())
        return self.db.scalar(statement)

    def list_all(self) -> list[User]:
        statement = select(User).order_by(User.name.asc(), User.id.asc())
        return list(self.db.scalars(statement).all())

    def list_by_role(self, role: str) -> list[User]:
        statement = select(User).where(User.role == role).order_by(User.name.asc(), User.id.asc())
        return list(self.db.scalars(statement).all())

    def create(self, user_in: UserCreate, password_hash: str, role: str = "user") -> User:
        user = User(
            name=user_in.name.strip(),
            email=user_in.email.lower(),
            password_hash=password_hash,
            role=role,
            job_title=user_in.job_title.strip() if user_in.job_title else None,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def save(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
