from fastapi.testclient import TestClient

from app.database import get_session
from app.main import app


class FakeResult:
    def scalar_one(self) -> int:
        return 1


class FakeSession:
    def execute(self, statement: object) -> FakeResult:
        return FakeResult()


client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_health_check_returns_connected() -> None:
    def override_get_session():
        yield FakeSession()

    app.dependency_overrides[get_session] = override_get_session

    try:
        response = client.get("/health/database")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}