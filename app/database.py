# app/database.py
import os
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./alembic_autogen.db"  # solo para alembic local
)

def get_engine():
    # SOLO crear /data si realmente usamos sqlite en Fly
    if DATABASE_URL.startswith("sqlite:////data"):
        os.makedirs("/data", exist_ok=True)

    return create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
        if DATABASE_URL.startswith("sqlite")
        else {}
    )

engine = get_engine()

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    return Session(engine)
