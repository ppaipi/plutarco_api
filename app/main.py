# app/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Body, Request, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from sqlmodel import Session, select
from .database import engine, init_db, get_session
from .models import Product, Order, OrderProduct
from .crud import (
    create_order, update_order, list_orders, get_order,
    update_or_create_product_by_data, get_product_by_codigo,
    set_product_habilitado, set_product_orden,
    import_habilitados_from_list, import_ordenes_from_mapping
)

import pandas as pd
from .import_excel import parse_precio
from typing import List, Optional
from datetime import datetime
import io
import csv
import json
from dotenv import load_dotenv
from openpyxl import load_workbook
import os
import re
from decimal import Decimal

import re

def parse_productos_celda(celda: str):
    """
    Parsea una celda de productos en formato A o B.
    Devuelve lista de:
    {codigo, nombre, cantidad, precio_unitario}
    """
    if not celda or not celda.strip():
        return []

    productos = []
    partes = [p.strip() for p in celda.split(",") if p.strip()]

    for parte in partes:
        # ----- Formato B -----
        # COD|Nombre|Cantidad|Precio
        if "|" in parte:
            cols = [c.strip() for c in parte.split("|")]
            if len(cols) == 4:
                codigo, nombre, cant, precio = cols
                try:
                    productos.append({
                        "codigo": codigo,
                        "nombre": nombre,
                        "cantidad": int(cant),
                        "precio_unitario": float(str(precio).replace(".", "").replace(",", ".")),
                    })
                    continue
                except:
                    pass  # intentar formato A

        # ----- Formato A -----
        # "Pan x1 ($2600)"
        match = re.match(r"(.+?)\s*x\s*(\d+)\s*\(\s*\$?\s*([\d\.,]+)\s*\)", parte)
        if match:
            nombre = match.group(1).strip()
            cantidad = int(match.group(2))
            precio_raw = match.group(3)

            try:
                precio = float(precio_raw.replace(".", "").replace(",", "."))
                productos.append({
                    "codigo": None,
                    "nombre": nombre,
                    "cantidad": cantidad,
                    "precio_unitario": precio,
                })
                continue
            except:
                pass

        print("Producto inválido ignorado:", parte)

    return productos


# -------------------------
# Cargar variables de entorno
# -------------------------
load_dotenv()
IMAGES_DIR = "/data/images"
os.makedirs(IMAGES_DIR, exist_ok=True)
ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")
API_KEY = os.getenv("API_KEY")


# -------------------------
# Inicializar API
# -------------------------
app = FastAPI(title="API Pedidos y Productos - extendida")
@app.get("/images/{filename}")
def serve_image(filename: str):
    filepath = os.path.join(IMAGES_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Imagen no encontrada")
    return FileResponse(filepath)

@app.on_event("startup")
def on_startup():
    init_db()


# -------------------------
# Archivos estáticos (panel admin)
# -------------------------
# Redirección manual a index.html
@app.get("/admin")
async def admin_root():
    file_path = os.path.join("app", "admin", "index.html")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(file_path)

# Servir archivos estáticos
app.mount("/admin", StaticFiles(directory="app/admin"), name="admin")

# -------------------------
# LOGIN ADMIN (para tu panel HTML)
# -------------------------

@app.post("/api/admin/login")
def admin_login(
    username: str = Form(...),
    password: str = Form(...)
):

    if username == ADMIN_USER and password == ADMIN_PASS:
        return {"access_token": API_KEY, "token_type": "bearer"}

    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

# -------------------------
# MIDDLEWARE DE API KEY
# -------------------------
PROTECTED_PATHS = [
    "/api/products/import",
    "/api/products/import-habilitados",
    "/api/products/import-ordenes",
    "/api/products/",    
    "/api/orders",
]


@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    path = request.url.path

    # Determinar si la ruta debe estar protegida
    if any(path.startswith(p) for p in PROTECTED_PATHS):

        key = request.headers.get("x-api-key")
        if key != API_KEY:
            return JSONResponse(
                {"error": "Unauthorized - Missing or invalid API Key"},
                status_code=401
            )

    return await call_next(request)


# -------------------------
# Productos (PÚBLICOS)
# -------------------------
@app.get("/api/products", response_model=List[Product])
def api_get_products():
    with get_session() as session:
        stmt = select(Product).order_by(Product.orden.asc())
        return session.exec(stmt).all()

@app.get("/api/products/enabled", response_model=List[Product])
def api_get_enabled():
    with get_session() as session:
        stmt = select(Product).where(Product.habilitado == True).order_by(Product.orden.asc())
        return session.exec(stmt).all()


@app.get("/api/products/by-codigo/{codigo}", response_model=Product)
def api_get_product_by_codigo(codigo: str):
    with get_session() as session:
        prod = get_product_by_codigo(session, codigo)
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return prod


# -------------------------
# IMPORTAR PRODUCTOS (ADMIN)
# -------------------------
@app.post("/api/products/import")
async def import_products(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Archivo debe ser .xlsx o .xls")

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
                "descripcion": str(row.get("DESCRIPCION ADICIONAL", "")).strip(),
                "categoria": str(row.get("RUBRO", "")).strip(),
                "subcategoria": str(row.get("SUBRUBRO", "")).strip(),
                "precio": parse_precio(row.get("PRECIO VENTA C/IVA", 0)),
                "proveedor": str(row.get("PROVEEDOR", "")).strip(),
            }

            existing = session.exec(
                select(Product).where(Product.codigo == codigo)
            ).first()

            if existing:
                update_or_create_product_by_data(session, data)
                updated += 1
            else:
                update_or_create_product_by_data(session, data)
                created += 1

    return {
        "ok": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_rows": len(df)
    }


# -------------------------
# CAMBIAR ESTADO/ORDEN (ADMIN)
# -------------------------
@app.put("/api/products/{product_id}/state")
def api_set_product_state(product_id: int, payload: dict = Body(...)):
    if "habilitado" not in payload:
        raise HTTPException(status_code=400, detail="Falta 'habilitado'")
    with get_session() as session:
        prod = set_product_habilitado(session, product_id=product_id, habilitado=payload["habilitado"])
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return {"ok": True, "product": prod}


@app.put("/api/products/{product_id}/order")
def api_set_product_order(product_id: int, payload: dict = Body(...)):
    if "orden" not in payload:
        raise HTTPException(status_code=400, detail="Falta 'orden'")

    with get_session() as session:
        prod = session.get(Product, product_id)
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        prod.orden = payload["orden"]
        session.add(prod)
        session.commit()
        session.refresh(prod)
        return {"ok": True, "product": prod}

# -------------------------
# IMPORTAR HABILITADOS (ADMIN)
# -------------------------
@app.post("/api/products/import-habilitados")
async def api_import_habilitados(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Archivo debe ser .json")

    content = await file.read()
    try:
        codigos = json.loads(content.decode("utf-8"))
        if not isinstance(codigos, list):
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON inválido")

    codigos = [str(c).strip() for c in codigos if str(c).strip()]

    with get_session() as session:
        result = import_habilitados_from_list(
            session,
            codigos_list=codigos,
            replace_others=True
        )

    return {"ok": True, "result": result}


# -------------------------
# IMPORTAR ORDENES (ADMIN)
# -------------------------
@app.post("/api/products/import-ordenes")
async def api_import_ordenes(
    file: UploadFile = File(...),
    match_by: Optional[str] = "nombre"
):
    if not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Archivo debe ser .csv")

    content = await file.read()
    reader = csv.reader(io.StringIO(content.decode("utf-8")), delimiter=";")

    mapping = []
    for row in reader:
        if len(row) < 2:
            continue

        raw_orden = row[0].strip()
        val = row[1].strip()

        # ❌ Si la primera columna NO es un número, la saltamos (headers)
        if not raw_orden.isdigit():
            continue

        orden = int(raw_orden)

        mapping.append(
            {"orden": orden, "codigo": val} if match_by == "codigo"
            else {"orden": orden, "nombre": val}
        )


    with get_session() as session:
        result = import_ordenes_from_mapping(session, mapping, match_by=match_by)

    return {"ok": True, "result": result}


# -------------------------
# PEDIDOS (PÚBLICOS)
# -------------------------
@app.post("/api/orders")
def api_create_order(payload: dict):
    required = ["nombre_completo", "correo", "productos"]
    for r in required:
        if r not in payload:
            raise HTTPException(status_code=400, detail=f"Falta campo {r}")

    if payload.get("dia_entrega"):
        try:
            payload["dia_entrega"] = datetime.fromisoformat(payload["dia_entrega"]).date()
        except:
            raise HTTPException(status_code=400, detail="Fecha inválida")

    order = Order(
        dia_entrega=payload.get("dia_entrega"),
        nombre_completo=payload["nombre_completo"],
        correo=payload["correo"],
        telefono=payload.get("telefono", ""),
        direccion=payload.get("direccion", ""),
        comentario=payload.get("comentario", ""),
        envio_cobrado=float(payload.get("envio_cobrado", 0)),
        costo_envio_real=float(payload.get("costo_envio_real", 0)),
        confirmado=bool(payload.get("confirmado", False)),
        entregado=bool(payload.get("entregado", False)),
    )

    with get_session() as session:
        new_order = create_order(session, order, payload["productos"])
        prods = session.exec(select(OrderProduct).where(OrderProduct.order_id == new_order.id)).all()
        return {"order": new_order, "productos": prods}


@app.put("/api/orders/{order_id}")
def api_update_order(order_id: int, payload: dict):
    with get_session() as session:
        updated = update_order(session, order_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        prods = session.exec(select(OrderProduct).where(OrderProduct.order_id == updated.id)).all()
        return {"order": updated, "productos": prods}


@app.get("/api/orders")
def api_list_orders():
    with get_session() as session:
        return session.exec(select(Order)).all()


@app.get("/api/orders/{order_id}")
def api_get_order(order_id: int):
    with get_session() as session:
        order = session.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        prods = session.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()
        return {"order": order, "productos": prods}
@app.post("/api/products/{codigo}/upload-image")
async def upload_image(
    codigo: str,
    file: UploadFile = File(...),
    request: Request = None
):
    # Validar extensión
    allowed = ["jpg", "jpeg", "png", "webp"]
    ext = file.filename.split(".")[-1].lower()
    if ext not in allowed:
        raise HTTPException(400, "Formato inválido")

    # Buscar producto
    with get_session() as session:
        product = session.exec(select(Product).where(Product.codigo == codigo)).first()
        if not product:
            raise HTTPException(404, "Producto no encontrado")

        # Guardar archivo
        filename = f"{codigo}.{ext}"
        save_path = os.path.join(IMAGES_DIR, filename)

        with open(save_path, "wb") as f:
            f.write(await file.read())

        # Guardar URL en la BD
        base_url = str(request.base_url).rstrip("/")
        product.imagen_url = f"{base_url}/images/{filename}"

        session.add(product)
        session.commit()
        session.refresh(product)

        return {
            "ok": True,
            "imagen_url": product.imagen_url
        }
@app.get("/api/products/no-image", response_model=List[Product])
def api_get_no_image():
    with get_session() as session:
        stmt = select(Product).where(
            (Product.imagen_url == None) | (Product.imagen_url == "")
        ).order_by(Product.orden.asc())
        return session.exec(stmt).all()


@app.post("/api/orders/{order_id}/items")
def add_order_item(order_id: int, payload: dict):
    """
    payload: { "codigo": "...", "nombre": "...", "cantidad": 1, "precio_unitario": 100.0 }
    """
    with get_session() as session:
        order = session.get(Order, order_id)
        if not order:
            raise HTTPException(404, "Pedido no encontrado")

        # Si existe producto en DB con ese codigo, linkear product_id
        product = None
        product_id = None
        if payload.get("codigo"):
            product = session.exec(select(Product).where(Product.codigo == payload["codigo"])).first()
            if product:
                product_id = product.id

        # crear OrderProduct (asumiendo modelo OrderProduct tiene campos: order_id, product_id(optional), nombre, cantidad, precio_unitario)
        op = OrderProduct(
            order_id = order_id,
            product_id = product_id,
            nombre = payload.get("nombre") or (product.nombre if product else ""),
            cantidad = int(payload.get("cantidad",1)),
            precio_unitario = float(payload.get("precio_unitario", 0.0))
        )
        session.add(op)
        session.commit()
        session.refresh(op)
        return {"ok": True, "item": op}

@app.put("/api/orders/{order_id}/items/{item_id}")
def update_order_item(order_id: int, item_id: int, payload: dict):
    with get_session() as session:
        op = session.get(OrderProduct, item_id)
        if not op or op.order_id != order_id:
            raise HTTPException(404, "Item no encontrado")
        # campos editables
        if "cantidad" in payload: op.cantidad = int(payload["cantidad"])
        if "precio_unitario" in payload: op.precio_unitario = float(payload["precio_unitario"])
        if "nombre" in payload: op.nombre = payload["nombre"]
        session.add(op)
        session.commit()
        session.refresh(op)
        return {"ok": True, "item": op}

@app.delete("/api/orders/{order_id}/items/{item_id}")
def delete_order_item(order_id: int, item_id: int):
    with get_session() as session:
        op = session.get(OrderProduct, item_id)
        if not op or op.order_id != order_id:
            raise HTTPException(404, "Item no encontrado")
        session.delete(op)
        session.commit()
        return {"ok": True}
# -------------------------
# BORRAR PEDIDO
# -------------------------
@app.delete("/api/orders/{order_id}")
def api_delete_order(order_id: int):
    with get_session() as session:
        order = session.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        # Borrar orderproducts asociados (si no hay cascade)
        session.exec(select(OrderProduct).where(OrderProduct.order_id == order_id)).all()
        # Si tu modelo tiene cascade, basta session.delete(order)
        for op in session.exec(select(OrderProduct).where(OrderProduct.order_id == order_id)).all():
            session.delete(op)
        session.delete(order)
        session.commit()
        return {"ok": True, "deleted": order_id}

# -------------------------
# BUSCADOR DE PRODUCTOS (TYPEAHEAD)
# -------------------------
@app.get("/api/products/search", response_model=List[Product])
def api_products_search(q: Optional[str] = None, limit: int = 20):
    with get_session() as session:
        if not q or q.strip() == "":
            stmt = select(Product).order_by(Product.nombre).limit(limit)
            return session.exec(stmt).all()
        term = f"%{q.lower().strip()}%"
        # SQLModel / SQLAlchemy: buscar por nombre o codigo (case-insensitive)
        stmt = select(Product).where(
            (Product.nombre.ilike(term)) | (Product.codigo.ilike(term))
        ).order_by(Product.orden.asc()).limit(limit)
        return session.exec(stmt).all()
@app.post("/api/orders/import-excel")
async def api_import_orders_excel(file: UploadFile = File(...)):
    """
    Importador de Excel de pedidos (formato 'Pedidos Delivery.xlsx').
    - Repara lo que puede
    - Si un producto está roto → se ignora
    - El pedido siempre se crea si tiene nombre y email
    """

    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Debe ser un archivo Excel (.xlsx o .xls)")

    content = await file.read()
    df = pd.read_excel(io.BytesIO(content)).fillna("")

    importados = 0
    errores = 0
    resultados = []

    with get_session() as session:
        for idx, row in df.iterrows():
            try:
                productos = parse_productos_celda(str(row.get("Productos", "")))

                # Convertir precios
                def parse_money(v):
                    if v == "" or v is None:
                        return 0
                    return float(str(v).replace(".", "").replace(",", "."))

                pedido_data = {
                    "hora_envio": row.get("Hora de envio"),
                    "nombre_completo": row.get("Nombre", "").strip(),
                    "correo": row.get("Email", "").strip(),
                    "telefono": str(row.get("Telefono", "")),
                    "direccion": row.get("Direccion", ""),
                    "comentario": row.get("Comentario", ""),
                    "subtotal": parse_money(row.get("Subtotal")),
                    "envio_cobrado": parse_money(row.get("Envio")),
                    "total": parse_money(row.get("total")),
                    "dia_entrega": row.get("dia de entrega") if row.get("dia de entrega") else None,
                    "confirmado": str(row.get("confirmado y pagado", "")).upper() == "TRUE",
                    "costo_envio_real": parse_money(row.get("COSTO ENVIO")),
                    "entregado": str(row.get("entregado", "")).upper() == "TRUE",
                    "productos": productos,
                }

                if not pedido_data["nombre_completo"] or not pedido_data["correo"]:
                    errores += 1
                    resultados.append({"fila": idx + 1, "error": "Falta nombre o email"})
                    continue

                # Crear pedido
                order = Order(
                    dia_entrega=pedido_data["dia_entrega"],
                    nombre_completo=pedido_data["nombre_completo"],
                    correo=pedido_data["correo"],
                    telefono=pedido_data["telefono"],
                    direccion=pedido_data["direccion"],
                    comentario=pedido_data["comentario"],
                    envio_cobrado=pedido_data["envio_cobrado"],
                    costo_envio_real=pedido_data["costo_envio_real"],
                    confirmado=pedido_data["confirmado"],
                    entregado=pedido_data["entregado"],
                )
                new_order = create_order(session, order, pedido_data["productos"])

                importados += 1
                resultados.append({"fila": idx + 1, "ok": True})

            except Exception as e:
                errores += 1
                resultados.append({"fila": idx + 1, "error": str(e)})

    return {
        "ok": True,
        "importados": importados,
        "errores": errores,
        "detalles": resultados
    }
