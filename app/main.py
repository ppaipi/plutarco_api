# app/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles

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

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "1234")
SECRET_TOKEN = os.getenv("SECRET_TOKEN", "supersecret-token")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/login")

def require_admin(token: str = Depends(oauth2_scheme)):
    if token != SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado")
    return True


# -------------------------
# Inicializar API
# -------------------------
app = FastAPI(title="API Pedidos y Productos - extendida")

@app.on_event("startup")
def on_startup():
    init_db()


# -------------------------
# Archivos estáticos para panel admin
# -------------------------
app.mount("/admin", StaticFiles(directory="app/admin"), name="admin")


# -------------------------
# LOGIN ADMIN
# -------------------------
@app.post("/admin/login")
def admin_login(form: OAuth2PasswordRequestForm = Depends()):
    if form.username == ADMIN_USER and form.password == ADMIN_PASS:
        return {"access_token": SECRET_TOKEN, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")


# -------------------------
# Productos (PÚBLICOS)
# -------------------------
@app.get("/products", response_model=List[Product])
def api_get_products():
    with get_session() as session:
        return session.exec(select(Product)).all()


@app.get("/products/habilitados", response_model=List[Product])
def api_list_habilitados():
    with get_session() as session:
        return session.exec(select(Product).where(Product.habilitado == True)).all()


@app.get("/products/by-codigo/{codigo}", response_model=Product)
def api_get_product_by_codigo(codigo: str):
    with get_session() as session:
        prod = get_product_by_codigo(session, codigo)
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return prod


# -------------------------
# IMPORTAR PRODUCTOS (ADMIN)
# -------------------------
@app.post("/products/import")
async def import_products(
    file: UploadFile = File(...),
    admin: bool = Depends(require_admin)
):
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
@app.put("/products/{product_id}/state")
def api_set_product_state(
    product_id: int,
    payload: dict = Body(...),
    admin: bool = Depends(require_admin)
):
    if "habilitado" not in payload:
        raise HTTPException(status_code=400, detail="Falta 'habilitado'")
    with get_session() as session:
        prod = set_product_habilitado(session, product_id=product_id, habilitado=payload["habilitado"])
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return {"ok": True, "product": prod}


@app.put("/products/{product_id}/order")
def api_set_product_order(
    product_id: int,
    payload: dict = Body(...),
    admin: bool = Depends(require_admin)
):
    if "orden" not in payload:
        raise HTTPException(status_code=400, detail="Falta 'orden'")
    with get_session() as session:
        prod = set_product_orden(session, product_id=product_id, orden=payload["orden"])
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return {"ok": True, "product": prod}


# -------------------------
# IMPORTAR HABILITADOS (ADMIN)
# -------------------------
@app.post("/products/import-habilitados")
async def api_import_habilitados(
    file: UploadFile = File(...),
    admin: bool = Depends(require_admin)
):
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
@app.post("/products/import-ordenes")
async def api_import_ordenes(
    file: UploadFile = File(...),
    match_by: Optional[str] = "nombre",
    admin: bool = Depends(require_admin)
):
    if not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Archivo debe ser .csv")

    content = await file.read()
    reader = csv.reader(io.StringIO(content.decode("utf-8")), delimiter=";")

    mapping = []
    for row in reader:
        if len(row) >= 2:
            orden = int(row[0].strip())
            val = row[1].strip()
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
@app.post("/orders")
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


@app.put("/orders/{order_id}")
def api_update_order(order_id: int, payload: dict):
    with get_session() as session:
        updated = update_order(session, order_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        prods = session.exec(select(OrderProduct).where(OrderProduct.order_id == updated.id)).all()
        return {"order": updated, "productos": prods}


@app.get("/orders")
def api_list_orders():
    with get_session() as session:
        return session.exec(select(Order)).all()


@app.get("/orders/{order_id}")
def api_get_order(order_id: int):
    with get_session() as session:
        order = session.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        prods = session.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()
        return {"order": order, "productos": prods}
