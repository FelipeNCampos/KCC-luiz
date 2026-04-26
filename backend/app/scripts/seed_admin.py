from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.cashflow import CashFlowRecord  # noqa: F401
from app.models.task import Task, TaskAssignment, TaskMedia, TaskMessage, TaskModuleSettings  # noqa: F401
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate


def main() -> None:
    if not settings.admin_email or not settings.admin_password:
        raise SystemExit("ADMIN_EMAIL and ADMIN_PASSWORD are required")

    db = SessionLocal()
    try:
        repository = UserRepository(db)
        existing = repository.get_by_email(settings.admin_email)
        if existing:
            print(f"Admin already exists: {existing.email}")
            return

        user_in = UserCreate(
            name=settings.admin_name or "Admin",
            email=settings.admin_email,
            password=settings.admin_password,
        )
        user = repository.create(user_in, hash_password(user_in.password), role="admin")
        print(f"Admin created: {user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
