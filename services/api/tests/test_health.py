from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from app.database import get_session
from app.main import app


class FakeSession:
    def execute(self, statement: object) -> None:
        return None


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


@patch("app.auth.httpx.get")
def test_me_returns_the_verified_user(mock_get: Mock) -> None:
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {
        "id": "0f5b624e-06a2-4b6b-9e25-520b3f6bc3a4",
        "email": "nysa@example.com",
    }

    response = client.get(
        "/me",
        headers={"Authorization": "Bearer pretend-access-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": "0f5b624e-06a2-4b6b-9e25-520b3f6bc3a4",
        "email": "nysa@example.com",
    }


def test_me_rejects_missing_token() -> None:
    response = client.get("/me")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Missing or invalid Authorization header."
    }