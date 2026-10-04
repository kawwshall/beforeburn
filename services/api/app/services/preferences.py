from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user_preference import UserPreference
from app.schemas.preferences import PreferencesUpdate


def get_or_create_preferences(
    session: Session,
    user_id: UUID,
) -> UserPreference:
    preferences = session.get(UserPreference, user_id)

    if preferences is None:
        preferences = UserPreference(user_id=user_id)
        session.add(preferences)
        session.commit()
        session.refresh(preferences)

    return preferences


def update_preferences(
    session: Session,
    preferences: UserPreference,
    changes: PreferencesUpdate,
) -> UserPreference:
    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(preferences, field, value)

    session.commit()
    session.refresh(preferences)
    return preferences