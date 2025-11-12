# app/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from sqlmodel import Session, select
from .database import engine, init_db, get_session
from .models import Product, Order, OrderProduct
from .crud import create_order, update_order, list_orders, get_order, create_product, get_products, get_product_by_codigo
import pandas as pd
from .import_excel import parse_precio
from typing import List
from datetime import datetime

app = FastAPI(title="API Pedidos y Productos")

@app.on_event("startup")
def on_startup():
    init_db()

# -------------------------
# Productos
# -------------------------
@app.get("/products", response_model=List[Product])
def api_get_products():
    with get_session() as session:
        return session.exec(select(Product)).all()

@app.post("/products/import")
async def import_products(file: UploadFile = File(...)):
    import io
    import pandas as pd
    from sqlmodel import select
    from .models import Product
    from .database import get_session
    from .import_excel import parse_precio

    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Archivo debe ser .xlsx o .xls")

    # Leer el archivo en memoria
    content = await file.read()
    df = pd.read_excel(io.BytesIO(content), engine="openpyxl")

    # Reemplazar NaN por strings vacíos
    df = df.fillna("")

    created = 0
    updated = 0
    skipped = 0

    with get_session() as session:
        for _, row in df.iterrows():
            # --- Código del producto ---
            codigo = str(row.get("CODIGO BARRA", "")).strip()
            if not codigo:
                codigo = str(row.get("ID", "")).strip()  # usar ID como fallback

            # --- Nombre del producto ---
            nombre = str(row.get("DESCRIPCION LARGA", "")).strip()
            if not nombre:
                nombre = str(row.get("DESCRIPCION", "")).strip()  # usar DESCRIPCION como fallback

            # Si ni código ni nombre existen, saltar fila
            if not codigo or not nombre:
                skipped += 1
                continue

            descripcion = str(row.get("DESCRIPCION ADICIONAL", "")).strip()
            categoria = str(row.get("RUBRO", "")).strip()
            subcategoria = str(row.get("SUBRUBRO", "")).strip()
            proveedor = str(row.get("PROVEEDOR", "")).strip()
            precio = parse_precio(row.get("PRECIO VENTA C/IVA", 0))

            existing = session.exec(select(Product).where(Product.codigo == codigo)).first()

            if existing:
                existing.nombre = nombre
                existing.descripcion = descripcion
                existing.categoria = categoria
                existing.subcategoria = subcategoria
                existing.precio = precio
                existing.proveedor = proveedor
                session.add(existing)
                updated += 1
            else:
                p = Product(
                    codigo=codigo,
                    nombre=nombre,
                    descripcion=descripcion,
                    categoria=categoria,
                    subcategoria=subcategoria,
                    precio=precio,
                    proveedor=proveedor,
                )
                session.add(p)
                created += 1

        session.commit()

    return {
        "ok": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_rows": len(df)
    }
from fastapi import Query
from typing import Optional

@app.get("/products/search", response_model=list[Product])
def search_products(
    codigo: Optional[str] = Query(None, description="Buscar por código o parte del código"),
    nombre: Optional[str] = Query(None, description="Buscar por nombre o parte del nombre"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría exacta"),
    proveedor: Optional[str] = Query(None, description="Filtrar por proveedor exacto")
):
    """
    Endpoint flexible para buscar productos por código, nombre, categoría o proveedor.
    Los filtros son opcionales y se pueden combinar.
    Ejemplo:
      /products/search?nombre=pan
      /products/search?categoria=almacen
      /products/search?codigo=123
    """
    from sqlmodel import select
    with get_session() as session:
        query = select(Product)

        if codigo:
            query = query.where(Product.codigo.ilike(f"%{codigo}%"))
        if nombre:
            query = query.where(Product.nombre.ilike(f"%{nombre}%"))
        if categoria:
            query = query.where(Product.categoria.ilike(f"%{categoria}%"))
        if proveedor:
            query = query.where(Product.proveedor.ilike(f"%{proveedor}%"))

        results = session.exec(query).all()
        return results

# -------------------------
# Pedidos
# -------------------------
@app.post("/orders")
def api_create_order(payload: dict):
    """
    payload esperado:
    {
      "dia_entrega": "2025-11-20",
      "nombre_completo": "...",
      "correo": "...",
      "telefono": "...",
      "direccion": "...",
      "comentario": "...",
      "envio_cobrado": 2500.0,
      "costo_envio_real": 2000.0,
      "productos": [
         {"codigo": "12345", "cantidad": 2, "precio_unitario": 500.0, "product_id": 1, "nombre": "Pan x"},
         ...
      ]
    }
    """
    # validaciones mínimas
    required = ["nombre_completo","correo","productos"]
    for r in required:
        if r not in payload:
            raise HTTPException(status_code=400, detail=f"Falta campo {r}")

    # parse fecha
    if "dia_entrega" in payload and payload["dia_entrega"]:
        try:
            payload["dia_entrega"] = datetime.fromisoformat(payload["dia_entrega"]).date()
        except Exception:
            raise HTTPException(status_code=400, detail="Formato dia_entrega inválido. Usá YYYY-MM-DD")

    # construir Order
    order = Order(
        dia_entrega = payload.get("dia_entrega"),
        nombre_completo = payload["nombre_completo"],
        correo = payload["correo"],
        telefono = payload.get("telefono",""),
        direccion = payload.get("direccion",""),
        comentario = payload.get("comentario",""),
        envio_cobrado = float(payload.get("envio_cobrado", 0.0)),
        costo_envio_real = float(payload.get("costo_envio_real", 0.0)),
        confirmado = bool(payload.get("confirmado", False)),
        entregado = bool(payload.get("entregado", False))
    )

    with get_session() as session:
        new_order = create_order(session, order, payload["productos"])
        # devolver con productos
        op_items = session.exec(select(OrderProduct).where(OrderProduct.order_id == new_order.id)).all()
        return {"order": new_order, "productos": op_items}

@app.put("/orders/{order_id}")
def api_update_order(order_id: int, payload: dict):
    with get_session() as session:
        updated = update_order(session, order_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        op_items = session.exec(select(OrderProduct).where(OrderProduct.order_id == updated.id)).all()
        return {"order": updated, "productos": op_items}

@app.get("/orders")
def api_list_orders():
    with get_session() as session:
        orders = session.exec(select(Order)).all()
        return orders

@app.get("/orders/{order_id}")
def api_get_order(order_id: int):
    with get_session() as session:
        order = session.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        productos = session.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()
        return {"order": order, "productos": productos}
