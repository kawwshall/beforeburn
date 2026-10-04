from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


def get_current_user(authorization: str | None = None) -> dict[str, Any]:
    """Return the Supabase user represented by a valid Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )

    access_token = authorization.removeprefix("Bearer ")
    response = httpx.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Authorization": f"Bearer {access_token}",
        },
        timeout=5.0,
    )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )

    return response.json()