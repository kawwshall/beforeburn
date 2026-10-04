from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_session

app = FastAPI(
    title="beforeburn API",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/database")
def database_health_check(
    session: Session = Depends(get_session),
) -> dict[str, str]:
    session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


def current_user_dependency(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    return get_current_user(authorization)


@app.get("/me")
def read_me(
    current_user: Annotated[dict[str, Any], Depends(current_user_dependency)],
) -> dict[str, str | None]:
    return {
        "id": current_user["id"],
        "email": current_user.get("email"),
    }