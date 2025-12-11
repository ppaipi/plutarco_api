# app/main.py

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Body, Request, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from datetime import date, datetime
from sqlmodel import Session, select
from .database import engine, init_db, get_session
from .models import Product, Order, OrderProduct
from .crud import (
    update_or_create_product_by_data, get_product_by_codigo,
    set_product_habilitado,
    import_habilitados_from_list, import_ordenes_from_mapping
)

import pandas as pd
import json
import io
import csv
import os
from typing import List, Optional
from dotenv import load_dotenv

# -------------------------
# RECOMPUTAR TOTALES
# -------------------------
def recompute_order_totals(session: Session, order: Order):
    productos = session.exec(
        select(OrderProduct).where(OrderProduct.order_id == order.id)
    ).all()

    order.subtotal = sum(
        (p.cantidad or 0) * (p.precio_unitario or 0)
        for p in productos
    )

    order.total = order.subtotal + (order.envio_cobrado or 0)

    session.add(order)
    session.commit()
    session.refresh(order)

    return order


# -------------------------
# ENV, CARPETAS
# -------------------------
load_dotenv()
IMAGES_DIR = "/data/images"
os.makedirs(IMAGES_DIR, exist_ok=True)
ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")
API_KEY = os.getenv("API_KEY")


# -------------------------
# FASTAPI APP
# -------------------------
app = FastAPI(title="API Pedidos y Productos - FINAL")

@app.on_event("startup")
def startup():
    init_db()


# -------------------------
# IMÁGENES
# -------------------------
@app.get("/images/{filename}")
def serve_image(filename: str):
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Imagen no encontrada")
    return FileResponse(path)


# -------------------------
# ARCHIVOS DEL PANEL
# -------------------------
@app.get("/productos/")
async def productos_root():
    return FileResponse("app/admin/products.html")

app.mount("/productos", StaticFiles(directory="app/admin"), name="productos")


@app.get("/pedidos/")
async def pedidos_root():
    return FileResponse("app/admin/pedidos.html")

app.mount("/pedidos", StaticFiles(directory="app/admin"), name="pedidos")


# -------------------------
# LOGIN ADMIN
# -------------------------
@app.post("/api/admin/login")
def admin_login(username: str = Form(...), password: str = Form(...)):
    if username == ADMIN_USER and password == ADMIN_PASS:
        return {"access_token": API_KEY}
    raise HTTPException(401, "Credenciales incorrectas")


# -------------------------
# API KEY MIDDLEWARE
# -------------------------
PROTECTED_PATHS = [
    "/api/products",
    "/api/orders",
]

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    path = request.url.path
    if any(path.startswith(p) for p in PROTECTED_PATHS):
        key = request.headers.get("x-api-key")
        if key != API_KEY:
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return await call_next(request)


# -------------------------
# PRODUCTOS – GET
# -------------------------
@app.get("/api/products", response_model=List[Product])
def api_get_products():
    with get_session() as s:
        return s.exec(select(Product).order_by(Product.orden.asc())).all()


@app.get("/api/products/enabled", response_model=List[Product])
def api_enabled():
    with get_session() as s:
        return s.exec(select(Product).where(Product.habilitado == True)
                      .order_by(Product.orden.asc())).all()


@app.get("/api/products/by-codigo/{codigo}", response_model=Product)
def api_get_by_codigo(codigo: str):
    with get_session() as s:
        prod = get_product_by_codigo(s, codigo)
        if not prod:
            raise HTTPException(404, "Producto no encontrado")
        return prod


# -------------------------
# IMPORTAR PRODUCTOS
# -------------------------
@app.post("/api/products/import")
async def import_products(file: UploadFile = File(...)):
    content = await file.read()
    df = pd.read_excel(io.BytesIO(content), engine="openpyxl").fillna("")

    created = 0
    updated = 0
    skipped = 0

    with get_session() as session:
        for _, row in df.iterrows():
            codigo = str(row.get("CODIGO BARRA", "")).strip() or str(row.get("ID", "")).strip()
            nombre = (
                str(row.get("DESCRIPCION LARGA", "")).strip()
                or str(row.get("DESCRIPCION", "")).strip()
            )
            if not codigo or not nombre:
                skipped += 1
                continue

            data = {
                "codigo": codigo,
                "nombre": nombre,
                "categoria": str(row.get("RUBRO", "")),
                "subcategoria": str(row.get("SUBRUBRO", "")),
                "precio": float(row.get("PRECIO VENTA C/IVA", 0)),
            }

            existing = session.exec(select(Product).where(Product.codigo == codigo)).first()

            update_or_create_product_by_data(session, data)
            created += 1 if not existing else 0
            updated += 1 if existing else 0

    return {"created": created, "updated": updated, "skipped": skipped}


# -------------------------
# PRODUCTOS – ESTADO
# -------------------------
@app.put("/api/products/{product_id}/state")
def api_set_state(product_id: int, payload: dict):
    if "habilitado" not in payload:
        raise HTTPException(400, "Falta habilitado")
    with get_session() as s:
        prod = set_product_habilitado(s, product_id, payload["habilitado"])
        if not prod:
            raise HTTPException(404)
        return {"ok": True}


# -------------------------
# SET ORDEN
# -------------------------
@app.put("/api/products/{product_id}/order")
def api_set_order(product_id: int, payload: dict):
    if "orden" not in payload:
        raise HTTPException(400, "Falta orden")

    with get_session() as s:
        prod = s.get(Product, product_id)
        if not prod:
            raise HTTPException(404)

        prod.orden = payload["orden"]
        s.commit()
        s.refresh(prod)

        return {"ok": True}


# -------------------------
# BUSCADOR TYPEAHEAD
# -------------------------
@app.get("/api/products/search", response_model=List[Product])
def api_search(q: Optional[str] = None, limit: int = 20):
    with get_session() as s:
        if not q:
            return s.exec(select(Product).order_by(Product.nombre).limit(limit)).all()

        term = f"%{q.lower().strip()}%"
        return s.exec(
            select(Product)
            .where(Product.nombre.ilike(term) | Product.codigo.ilike(term))
            .order_by(Product.nombre)
            .limit(limit)
        ).all()


# =====================================================
# =====================  PEDIDOS  ======================
# =====================================================

# -------------------------
# CREAR PEDIDO (POST)
# -------------------------
@app.post("/api/orders")
def api_create_order(payload: dict):

    # fecha
    if payload.get("dia_entrega"):
        payload["dia_entrega"] = date.fromisoformat(payload["dia_entrega"])

    order = Order(
        nombre_completo=payload["nombre_completo"],
        correo=payload["correo"],
        telefono=payload.get("telefono", ""),
        direccion=payload.get("direccion", ""),
        comentario=payload.get("comentario", ""),
        dia_entrega=payload.get("dia_entrega"),
        envio_cobrado=float(payload.get("envio_cobrado", 0)),
        costo_envio_real=float(payload.get("costo_envio_real", 0)),
        confirmado=bool(payload.get("confirmado", False)),
        entregado=bool(payload.get("entregado", False)),
    )

    productos_payload = payload.get("productos", [])

    with get_session() as s:
        s.add(order)
        s.commit()
        s.refresh(order)

        # crear productos
        for p in productos_payload:
            product_db = None
            if p.get("codigo"):
                product_db = s.exec(select(Product).where(Product.codigo == p["codigo"])).first()

            op = OrderProduct(
                codigo=p.get("codigo") or (product_db.codigo if product_db else "GENERIC"),
                order_id=order.id,
                product_id=product_db.id if product_db else None,
                nombre=p.get("nombre") or (product_db.nombre if product_db else ""),
                cantidad=int(p.get("cantidad", 1)),
                precio_unitario=float(p.get("precio_unitario", 0)),
            )
            s.add(op)

        s.commit()
        recompute_order_totals(s, order)

        items = s.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()

        return {"order": order, "productos": items}


# -------------------------
# ACTUALIZAR PEDIDO (PUT)
# -------------------------
@app.put("/api/orders/{order_id}")
def api_update_order(order_id: int, payload: dict):

    with get_session() as s:
        order = s.get(Order, order_id)
        if not order:
            raise HTTPException(404, "Pedido no encontrado")

        # actualizar campos
        if payload.get("dia_entrega"):
            try:
                order.dia_entrega = date.fromisoformat(payload["dia_entrega"])
            except:
                raise HTTPException(400, "Fecha inválida")

        order.nombre_completo = payload.get("nombre_completo", order.nombre_completo)
        order.correo = payload.get("correo", order.correo)
        order.telefono = payload.get("telefono", order.telefono)
        order.direccion = payload.get("direccion", order.direccion)
        order.comentario = payload.get("comentario", order.comentario)
        order.envio_cobrado = float(payload.get("envio_cobrado", order.envio_cobrado))
        order.costo_envio_real = float(payload.get("costo_envio_real", order.costo_envio_real))
        order.confirmado = bool(payload.get("confirmado", order.confirmado))
        order.entregado = bool(payload.get("entregado", order.entregado))

        # -------------------------
        # REEMPLAZAR PRODUCTOS
        # -------------------------
        if "items" in payload:     # <--- AHORA SÍ
            # borrar productos anteriores
            old_items = s.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()
            for it in old_items:
                s.delete(it)
            s.commit()

            # cargar nuevos ítems
            for p in payload["items"]:
                product_db = None
                if p.get("codigo"):
                    product_db = s.exec(select(Product).where(Product.codigo == p["codigo"])).first()

                op = OrderProduct(
                    codigo=p.get("codigo") or (product_db.codigo if product_db else "GENERIC"),
                    order_id=order.id,
                    product_id=product_db.id if product_db else None,
                    nombre=p.get("nombre") or (product_db.nombre if product_db else ""),
                    cantidad=int(p.get("cantidad", 1)),
                    precio_unitario=float(p.get("precio_unitario", 0)),
                )
                s.add(op)

        s.commit()
        recompute_order_totals(s, order)

        items = s.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()

        return {"order": order, "productos": items}


# -------------------------
# LISTAR
# -------------------------
@app.get("/api/orders")
def api_get_orders():
    with get_session() as s:
        return s.exec(select(Order)).all()


@app.get("/api/orders/{order_id}")
def api_get_order(order_id: int):
    with get_session() as s:
        order = s.get(Order, order_id)
        if not order:
            raise HTTPException(404)

        items = s.exec(select(OrderProduct).where(OrderProduct.order_id == order_id)).all()
        return {"order": order, "productos": items}


# -------------------------
# BORRAR ITEM
# -------------------------
@app.delete("/api/orders/{order_id}/items/{item_id}")
def api_delete_item(order_id: int, item_id: int):
    with get_session() as s:
        op = s.get(OrderProduct, item_id)
        if not op or op.order_id != order_id:
            raise HTTPException(404)

        s.delete(op)
        s.commit()

        order = s.get(Order, order_id)
        recompute_order_totals(s, order)

        return {"ok": True}


# -------------------------
# BORRAR PEDIDO
# -------------------------
@app.delete("/api/orders/{order_id}")
def api_delete_order(order_id: int):
    with get_session() as s:
        order = s.get(Order, order_id)
        if not order:
            raise HTTPException(404)

        items = s.exec(select(OrderProduct).where(OrderProduct.order_id == order_id)).all()
        for it in items:
            s.delete(it)

        s.delete(order)
        s.commit()
        return {"ok": True}


# -------------------------
# ELIMINAR TODOS LOS PEDIDOS
# -------------------------
@app.delete("/api/orders/delete/all")
def api_delete_all():
    with get_session() as s:
        s.exec("DELETE FROM orderproduct")
        s.exec("DELETE FROM 'order'")
        s.commit()
        return {"ok": True, "message": "Todos los pedidos eliminados"}


# -------------------------
# IMPORTAR PEDIDOS DESDE EXCEL
# -------------------------
@app.post("/api/orders/import-excel")
async def api_import_orders_excel(file: UploadFile = File(...)):
    content = await file.read()
    df = pd.read_excel(io.BytesIO(content), engine="openpyxl").fillna("")

    created = 0
    errors = []

    with get_session() as s:
        for idx, row in df.iterrows():
            try:
                nombre = str(row.get("Nombre", "")).strip()
                email = str(row.get("Email", "")).strip()
                if not nombre:
                    errors.append(f"Fila {idx+1}: sin nombre")
                    continue

                dia_raw = row.get("dia de entrega", "")
                try:
                    dia_entrega = pd.to_datetime(dia_raw).date() if dia_raw else None
                except:
                    dia_entrega = None

                total_excel = (
                    row.get("total") or row.get("Total") or row.get("Subtotal") or 0
                )
                try:
                    total_excel = float(str(total_excel).replace("$", "").replace(".", "").replace(",", "."))
                except:
                    total_excel = 0

                order = Order(
                    nombre_completo=nombre,
                    correo=email,
                    telefono=str(row.get("Telefono", "")),
                    direccion=str(row.get("Direccion", "")),
                    comentario=str(row.get("Comentario", "")),
                    dia_entrega=dia_entrega,
                    envio_cobrado=total_excel,
                    costo_envio_real=0,
                    confirmado=str(row.get("confirmado y pagado", "")).strip().upper()=="TRUE",
                    entregado=str(row.get("entregado", "")).strip().upper()=="TRUE",
                )

                s.add(order)
                s.commit()
                s.refresh(order)

                op = OrderProduct(
                    codigo="GENERIC",
                    order_id=order.id,
                    nombre="PRODUCTO GENERICO",
                    cantidad=1,
                    precio_unitario=total_excel
                )
                s.add(op)
                s.commit()

                created += 1

            except Exception as e:
                errors.append(f"Fila {idx+1}: {str(e)}")

    return {"created": created, "errors": errors}
