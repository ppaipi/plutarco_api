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
import os

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
