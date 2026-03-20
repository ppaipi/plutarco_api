import os
from logging.config import fileConfig
from app.database import DATABASE_URL
from sqlalchemy import engine_from_config, pool
from alembic import context
from sqlmodel import SQLModel

from app import models  # importa los modelos

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def get_url():
    url = DATABASE_URL
    if not url:
        raise RuntimeError(
            "DATABASE_URL no está definida. "
            "Las migraciones solo se ejecutan en Fly."
        )
    return url


def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": get_url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError(
        "Las migraciones offline no están soportadas. "
        "Ejecuta las migraciones en modo online."
    )
else:
    run_migrations_online()
