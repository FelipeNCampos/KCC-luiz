from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.cashflow import CashFlowRecord  # noqa: F401
from app.models.task import Task, TaskAssignment, TaskMedia, TaskMessage, TaskModuleSettings  # noqa: F401
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate


def main() -> None:
    db = SessionLocal()
    try:
        repository = UserRepository(db)
        _seed_user(
            repository=repository,
            name=settings.admin_name or "Admin",
            email=settings.admin_email,
            password=settings.admin_password,
            role="admin",
            job_title=None,
            label="Admin",
        )
        _seed_user(
            repository=repository,
            name=settings.secondary_user_name or "Oakhill Porter",
            email=settings.secondary_user_email,
            password=settings.secondary_user_password,
            role=settings.secondary_user_role,
            job_title=settings.secondary_user_job_title,
            label="Secondary user",
        )
    finally:
        db.close()


def _seed_user(
    repository: UserRepository,
    name: str,
    email: str | None,
    password: str | None,
    role: str,
    job_title: str | None,
    label: str,
) -> None:
    if not email or not password:
        print(f"{label} skipped: missing credentials")
        return

    existing = repository.get_by_email(email)
    if existing:
        changed = False
        if existing.role != role:
            existing.role = role
            changed = True
        if job_title is not None and existing.job_title != job_title:
            existing.job_title = job_title
            changed = True
        if changed:
            repository.save(existing)
            print(f"{label} updated: {existing.email}")
            return
        print(f"{label} already exists: {existing.email}")
        return

    user_in = UserCreate(
        name=name,
        email=email,
        password=password,
        job_title=job_title,
    )
    user = repository.create(user_in, hash_password(user_in.password), role=role)
    print(f"{label} created: {user.email}")


if __name__ == "__main__":
    main()
