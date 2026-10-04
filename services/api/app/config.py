import os

from dotenv import load_dotenv

load_dotenv()


def required_setting(name: str) -> str:
    value = os.environ.get(name)

    if not value:
        raise RuntimeError(f"{name} is missing. Add it to services/api/.env.")

    return value


DATABASE_URL = required_setting("DATABASE_URL")
SUPABASE_URL = required_setting("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = required_setting("SUPABASE_PUBLISHABLE_KEY")