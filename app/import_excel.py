# app/import_excel.py
import pandas as pd
from .models import Product
from .database import get_session
from .crud import create_product

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

def import_from_excel(path_excel):
    df = pd.read_excel(path_excel, engine="openpyxl")
    # usa exactamente los nombres de columnas que dijiste
    # Ajusta nombres si difieren
    with get_session() as session:
        for _, row in df.iterrows():
            codigo = str(row.get("CODIGO BARRA","")).strip()
            nombre = row.get("DESCRIPCION LARGA","") or ""
            descripcion = row.get("DESCRIPCION ADICIONAL","") or ""
            categoria = row.get("RUBRO","") or ""
            subcategoria = row.get("SUBRUBRO","") or ""
            precio = parse_precio(row.get("PRECIO VENTA C/IVA", 0))
            proveedor = row.get("PROVEEDOR","") or ""
            # Si ya existe por codigo, actualizar; sino crear
            existing = session.exec(select(Product).where(Product.codigo == codigo)).first()
            if existing:
                existing.nombre = nombre
                existing.descripcion = descripcion
                existing.categoria = categoria
                existing.subcategoria = subcategoria
                existing.precio = precio
                existing.proveedor = proveedor
                session.add(existing)
            else:
                p = Product(codigo=codigo, nombre=nombre, descripcion=descripcion,
                            categoria=categoria, subcategoria=subcategoria,
                            precio=precio, proveedor=proveedor)
                session.add(p)
        session.commit()
