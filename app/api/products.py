from fastapi import status, APIRouter, HTTPException, Query, Body
from fastapi import Form, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from app.models import Product
from sqlmodel import select, delete
from app.database import get_session
import pandas as pd
import io
import csv
import json
from app.crud import (
    get_product_by_codigo,
    update_product_from_data,
    toggle_product_habilitado,
    get_product_by_nombre
)

def get_product_for_import(session, product_id=None, codigo=None):
    if product_id:
        product = session.exec(
            select(Product).where(Product.id == product_id)
        ).first()
        if product:
            return product

    if codigo:
        return session.exec(
            select(Product).where(Product.codigo == codigo)
        ).first()

    return None


def parse_precio(valor):
    # adaptalo a tu formato: si viene "1.234,56" o "1234.56"
    try:
        if isinstance(valor, str):
            # quitar puntos miles y reemplazar coma decimal
            v = valor.replace(".", "").replace(",", ".")
            return float(v)
        return float(valor)
    except:
        return 0.0

# ===================== MODELOS PYDANTIC =====================
class SetStatePayload(BaseModel):
    habilitado: bool

class SetOrderPayload(BaseModel):
    orden: int

# Router con prefix correcto
router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=List[Product])
def api_get_products():
    with get_session() as s:
        return s.exec(select(Product).order_by(Product.orden.asc())).all()


@router.get("/enabled", response_model=List[Product])
def api_enabled():
    with get_session() as s:
        return s.exec(
            select(Product)
            .where(Product.habilitado == True)
            .order_by(Product.orden.asc())
        ).all()


@router.get("/by-codigo/{codigo}", response_model=Product)
def api_get_by_codigo(codigo: str):
    with get_session() as s:
        prod = get_product_by_codigo(s, codigo)
        if not prod:
            raise HTTPException(404, "Producto no encontrado")
        return prod


# -------------------------
# IMPORTAR PRODUCTOS
# -------------------------
import random
import string

def gen_product_id(length=4):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

@router.post("/import-excel", status_code=status.HTTP_201_CREATED)
async def import_products(file: UploadFile = File(...)):
    try:
        content = await file.read()
        df = pd.read_excel(io.BytesIO(content), engine="openpyxl").fillna("")

        created = 0
        updated = 0
        skipped = 0

        with get_session() as session:
            for _, row in df.iterrows():

                id_product = str(row.get("ID", "")).strip() or None
                codigo = str(row.get("CODIGO BARRA", "")).strip()
                nombre = (
                    str(row.get("DESCRIPCION LARGA", "")).strip()
                    or str(row.get("DESCRIPCION", "")).strip()
                )

                if not nombre:
                    skipped += 1
                    continue

                data = {
                    "codigo": codigo,
                    "nombre": nombre,
                    "categoria": str(row.get("RUBRO", "")),
                    "subcategoria": str(row.get("SUBRUBRO", "")),
                    "precio": parse_precio(row.get("PRECIO VENTA C/IVA")),
                    "descripcion": str(row.get("DESCRIPCION ADICIONAL", "")),
                    "proveedor": str(row.get("PROVEEDOR", "")),
                }

                existing = get_product_for_import(
                    session,
                    product_id=id_product,
                    codigo=codigo
                )

                if existing:
                    update_product_from_data(existing, data)
                    if id_product:
                        existing.id = id_product
                    session.add(existing)
                    updated += 1
                else:
                    p = Product(
                        id=id_product or gen_product_id(),          
                        codigo=data["codigo"],
                        nombre=data["nombre"],
                        descripcion=data["descripcion"],
                        categoria=data["categoria"],
                        subcategoria=data["subcategoria"],
                        precio=float(data["precio"] or 0.0),
                        proveedor=data["proveedor"],
                        habilitado=False,
                        orden=None
                    )
                    session.add(p)
                    created += 1

            session.commit()

        return {
            "created": created,
            "updated": updated,
            "skipped": skipped
        }
    except Exception as e:
        print("Error importing products from excel:", e)
        raise HTTPException(status_code=500, detail="Error importing products")


@router.post("/import-habilitados", status_code=status.HTTP_201_CREATED)
async def import_habilitados(file: UploadFile = File(...)):
    updated = 0
    skipped = 0

    try:
        content = await file.read()

        # Parsear JSON
        codigos = json.loads(content)

        if not isinstance(codigos, list):
            raise HTTPException(
                status_code=400,
                detail="El archivo debe contener una lista JSON de códigos"
            )

        with get_session() as session:
            for codigo in codigos:
                codigo = str(codigo).strip()
                if not codigo:
                    skipped += 1
                    continue

                product = get_product_by_codigo(session, codigo)

                if product:
                    if not product.habilitado:
                        product.habilitado = True
                        session.add(product)
                        updated += 1
                else:
                    skipped += 1

            session.commit()

        return {
            "updated": updated,
            "skipped": skipped,
            "total_received": len(codigos)
        }

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="El archivo no es un JSON válido"
        )
    except Exception as e:
        print("Error enabling products from json:", e)
        raise HTTPException(status_code=500, detail="Error enabling products")


@router.post("/import-orders", status_code=status.HTTP_201_CREATED)
async def import_order_from_csv(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    updated = 0
    skipped = 0

    reader = csv.reader(io.StringIO(text), delimiter=";")

    with get_session() as session:
        for row in reader:
            if len(row) < 2:
                skipped += 1
                continue

            try:
                orden = int(str(row[0]).strip())
            except ValueError:
                skipped += 1
                continue

            nombre = str(row[1]).strip()

            if not nombre:
                skipped += 1
                continue

            product = get_product_by_nombre(session, nombre)

            if product:
                product.orden = orden
                session.add(product)
                updated += 1
            else:
                skipped += 1

        session.commit()

    return {
        "updated": updated,
        "skipped": skipped
    }

# -------------------------
# PRODUCTOS – ESTADO
# -------------------------
@router.put("/{product_id}/state")
def api_set_state(product_id: int, payload: SetStatePayload):
    with get_session() as s:
        prod = toggle_product_habilitado(s, product_id=product_id, habilitado=payload.habilitado)
        if not prod:
            raise HTTPException(404, "Producto no encontrado")
        return {"ok": True}


# -------------------------
# SET ORDEN
# -------------------------
@router.put("/{product_id}/order")
def api_set_order(product_id: int, payload: SetOrderPayload):
    with get_session() as s:
        prod = s.get(Product, product_id)
        if not prod:
            raise HTTPException(404, "Producto no encontrado")

        prod.orden = payload.orden
        s.add(prod)
        s.commit()
        s.refresh(prod)

        return {"ok": True}


# -------------------------
# BUSCADOR TYPEAHEAD
# -------------------------
@router.get("/search", response_model=List[Product])
def api_search(q: Optional[str] = None, limit: int = 20):
    with get_session() as s:
        if not q:
            return s.exec(
                select(Product)
                .order_by(Product.nombre)
                .limit(limit)
            ).all()

        term = f"%{q.lower().strip()}%"
        return s.exec(
            select(Product)
            .where(Product.nombre.ilike(term) | Product.codigo.ilike(term))
            .order_by(Product.nombre)
            .limit(limit)
        ).all()

@router.get("/categories", response_model=List[str])
def api_get_categories():
    try:
        with get_session() as s:
            # exec() may return Result or ScalarResult depending on SQLModel/SQLAlchemy versions
            res = s.exec(select(Product.categoria).distinct())
            if hasattr(res, "scalars"):
                results = res.scalars().all()
            else:
                results = res.all()

            categories = []
            seen = set()
            for c in results:
                if c is None:
                    continue
                v = str(c).strip()
                if not v:
                    continue
                if v in seen:
                    continue
                seen.add(v)
                categories.append(v)
            return categories
    except Exception as e:
        print("Error loading categories:", e)
        return []
    
@router.get("/subcategories", response_model=List[str])
def api_get_subcategories():
    try:
        with get_session() as s:
            res = s.exec(select(Product.subcategoria).distinct())
            if hasattr(res, "scalars"):
                results = res.scalars().all()
            else:
                results = res.all()

            subcategories = []
            seen = set()
            for c in results:
                if c is None:
                    continue
                v = str(c).strip()
                if not v:
                    continue
                if v in seen:
                    continue
                seen.add(v)
                subcategories.append(v)
            return subcategories
    except Exception as e:
        print("Error loading subcategories:", e)
        return []
    
@router.delete("/delete/all")
def delete_all_products():
    with get_session() as s:
        result = s.exec(delete(Product))
        s.commit()

        return {
            "deleted": result.rowcount or 0
        }
