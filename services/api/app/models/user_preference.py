from datetime import datetime, time
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, Time, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserPreference(Base):
    """One user's beforeburn preferences."""

    __tablename__ = "user_preferences"

    user_id: Mapped[UUID] = mapped_column(primary_key=True)
    time_zone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        server_default=text("'UTC'"),
    )
    sleep_start: Mapped[time | None] = mapped_column(Time(), nullable=True)
    sleep_end: Mapped[time | None] = mapped_column(Time(), nullable=True)
    reduced_motion: Mapped[bool] = mapped_column(
        Boolean(),
        nullable=False,
        server_default=false(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )