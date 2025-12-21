from fastapi import status, APIRouter, HTTPException, Query
from fastapi import Form, UploadFile, File
from typing import List, Optional
from app.models import Product
from sqlmodel import select
from app.database import get_session
import pandas as pd
import io
from app.crud import (
    get_product_by_codigo,
    update_or_create_product_by_data,
    set_product_habilitado,
)

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
@router.post("/import")
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

            existing = session.exec(
                select(Product).where(Product.codigo == codigo)
            ).first()

            update_or_create_product_by_data(session, data)
            created += 1 if not existing else 0
            updated += 1 if existing else 0

    return {"created": created, "updated": updated, "skipped": skipped}


# -------------------------
# PRODUCTOS – ESTADO
# -------------------------
@router.put("/{product_id}/state")
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
@router.put("/{product_id}/order")
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