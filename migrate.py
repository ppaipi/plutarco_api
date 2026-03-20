from sqlmodel import SQLModel
from app.db import engine   # o donde esté tu engine

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
