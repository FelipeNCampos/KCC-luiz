import os

os.environ.setdefault("SECRET_KEY", "test_secret_key_with_more_than_32_chars")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.cashflow import CashFlowRecord  # noqa: F401
from app.models.oakhill import Acess, Building, Condominio, ContractorHistory, ContractorHistoryCategory, ContractorVisit, Funcionario  # noqa: F401
from app.models.task import Task, TaskAssignment, TaskMedia, TaskMessage, TaskModuleSettings  # noqa: F401
from app.models.user import User  # noqa: F401

engine = create_engine(
    os.environ["DATABASE_URL"],
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
