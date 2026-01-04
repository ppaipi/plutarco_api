from sqlmodel import create_engine
from sqlalchemy import text

DATABASE_URL = "sqlite:///data/pedidos_productos.db"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS product"))
    conn.commit()

print("Tabla product eliminada correctamente")

