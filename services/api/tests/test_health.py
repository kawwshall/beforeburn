from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import UUID

from fastapi.testclient import TestClient

from app.database import get_session
from app.main import app, current_user_dependency


class FakeSession:
    def execute(self, statement: object) -> None:
        return None


client = TestClient(app)

USER_ID = UUID("0f5b624e-06a2-4b6b-9e25-520b3f6bc3a4")


def sample_preferences() -> SimpleNamespace:
    now = datetime(2026, 10, 4, tzinfo=timezone.utc)

    return SimpleNamespace(
        user_id=USER_ID,
        time_zone="Asia/Kolkata",
        sleep_start=None,
        sleep_end=None,
        reduced_motion=False,
        created_at=now,
        updated_at=now,
    )


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
        "id": str(USER_ID),
        "email": "nysa@example.com",
    }

    response = client.get(
        "/me",
        headers={"Authorization": "Bearer pretend-access-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(USER_ID),
        "email": "nysa@example.com",
    }


def test_me_rejects_missing_token() -> None:
    response = client.get("/me")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Missing or invalid Authorization header."
    }


@patch("app.main.get_or_create_preferences")
def test_preferences_returns_only_current_users_data(mock_get: Mock) -> None:
    mock_get.return_value = sample_preferences()
    app.dependency_overrides[current_user_dependency] = lambda: {
        "id": str(USER_ID)
    }
    app.dependency_overrides[get_session] = lambda: FakeSession()

    try:
        response = client.get("/me/preferences")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["user_id"] == str(USER_ID)
    assert response.json()["time_zone"] == "Asia/Kolkata"


@patch("app.main.update_preferences")
@patch("app.main.get_or_create_preferences")
def test_preferences_patch_updates_only_sent_fields(
    mock_get: Mock,
    mock_update: Mock,
) -> None:
    updated_preferences = sample_preferences()
    updated_preferences.reduced_motion = True

    mock_get.return_value = sample_preferences()
    mock_update.return_value = updated_preferences
    app.dependency_overrides[current_user_dependency] = lambda: {
        "id": str(USER_ID)
    }
    app.dependency_overrides[get_session] = lambda: FakeSession()

    try:
        response = client.patch(
            "/me/preferences",
            json={"reduced_motion": True},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["reduced_motion"] is True

    submitted_changes = mock_update.call_args.args[2]
    assert submitted_changes.model_dump(exclude_unset=True) == {
        "reduced_motion": True
    }