from sqlmodel import create_engine
from sqlalchemy import text

DATABASE_URL = "sqlite:///data/pedidos_productos.db"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE "order" ADD COLUMN dia_pedido DATE'))
    conn.commit()

print("✅ Columna dia_pedido agregada correctamente")
