# app/database.py
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = "sqlite:////data/pedidos_productos.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    return Session(engine)
