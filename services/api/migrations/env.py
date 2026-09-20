import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

load_dotenv()

database_url = os.environ.get("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL is missing. Add it to services/api/.env.")

# Alembic reads this value from its config object. Double percent signs protect
# percent-encoded characters that may be present in a database password.
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

# Models will be added in a later lab. For now, migrations are written manually.
target_metadata = None


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()