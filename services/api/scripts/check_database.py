import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

database_url = os.environ.get("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL is missing. Add it to services/api/.env.")

engine = create_engine(database_url, pool_pre_ping=True)

with engine.connect() as connection:
    result = connection.execute(text("SELECT 1"))
    assert result.scalar_one() == 1

print("Database connection succeeded.")