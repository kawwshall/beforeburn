from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PreferencesResponse(BaseModel):
    """Safe preference data returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    time_zone: str
    sleep_start: time | None
    sleep_end: time | None
    reduced_motion: bool
    created_at: datetime
    updated_at: datetime


class PreferencesUpdate(BaseModel):
    """Optional changes to one user's preferences."""

    time_zone: str | None = Field(default=None, min_length=1, max_length=64)
    sleep_start: time | None = None
    sleep_end: time | None = None
    reduced_motion: bool | None = None

    @model_validator(mode="after")
    def time_zone_cannot_be_cleared(self) -> "PreferencesUpdate":
        if "time_zone" in self.model_fields_set and self.time_zone is None:
            raise ValueError("time_zone cannot be null")

        return self