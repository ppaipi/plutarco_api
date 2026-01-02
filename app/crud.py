# app/crud.py
from sqlmodel import select
from .models import Product, Order, OrderProduct
from .database import get_session
from typing import List, Optional

# ---------- Productos ----------
def create_product(session, product: Product):
    session.add(product)
    session.commit()
    session.refresh(product)
    return product

def get_products(session) -> List[Product]:
    return session.exec(select(Product)).all()

def get_product_by_codigo(session, codigo: str) -> Optional[Product]:
    return session.exec(select(Product).where(Product.codigo == codigo)).first()

def get_product_by_id(session, product_id: int) -> Optional[Product]:
    return session.get(Product, product_id)

def get_product_by_nombre(session, nombre: str) -> Optional[Product]:
    return session.exec(select(Product).where(Product.nombre == nombre)).first()

def update_product_full(session, codigo: str, data: dict):
    """
    Actualiza todas las propiedades del producto identificado por 'codigo',
    pero NO modifica 'orden' ni 'habilitado' (se preservan).
    """
    prod = get_product_by_codigo(session, codigo)
    if not prod:
        return None
    # preservar
    orden = prod.orden
    habilitado = prod.habilitado

    # actualizar campos (si vienen)
    for k in ["nombre","descripcion","categoria","subcategoria","precio","proveedor","codigo"]:
        if k in data:
            setattr(prod, k, data[k])
    # restaurar preservados (en caso que fueran pasados en data)
    prod.orden = orden
    prod.habilitado = habilitado

    session.add(prod)
    session.commit()
    session.refresh(prod)
    return prod

def update_product_from_data(product: Product, data: dict):
    """
    Actualiza SOLO campos editables.
    NO toca id, orden ni habilitado.
    """
    if data.get("codigo"):
        product.codigo = data["codigo"]

    product.nombre = data.get("nombre", product.nombre)
    product.descripcion = data.get("descripcion", product.descripcion)
    product.categoria = data.get("categoria", product.categoria)
    product.subcategoria = data.get("subcategoria", product.subcategoria)
    product.precio = float(data.get("precio", product.precio or 0.0))
    product.proveedor = data.get("proveedor", product.proveedor or "")

def toggle_product_habilitado(session, product_id: int = None, codigo: str = None, habilitado: bool = None):
    """
    Actualiza el campo habilitado de un producto identificado por id o codigo.
    """
    prod = None
    if product_id:
        prod = get_product_by_id(session, product_id)
    elif codigo:
        prod = get_product_by_codigo(session, codigo)
    if not prod:
        return None
    if habilitado is not None:
        prod.habilitado = bool(habilitado)
    session.add(prod)
    session.commit()
    session.refresh(prod)
    return prod

def set_product_orden(session, product_id: int = None, codigo: str = None, orden: int = None):
    """
    Actualiza el campo orden de un producto identificado por id o codigo.
    """
    prod = None
    if product_id:
        prod = get_product_by_id(session, product_id)
    elif codigo:
        prod = get_product_by_codigo(session, codigo)
    if not prod:
        return None
    try:
        prod.orden = int(orden) if orden is not None else None
    except Exception:
        prod.orden = None
    session.add(prod)
    session.commit()
    session.refresh(prod)
    return prod

# funciones para importaciones masivas
def import_habilitados_from_list(session, codigos_list: List[str], replace_others: bool = False):
    """
    Dado un listado de códigos, setea habilitado = True para los códigos de la lista.
    Si replace_others == True, pone habilitado = False para los productos que NO estén en la lista.
    Devuelve dict con conteos.
    """
    codigos_set = set([str(c).strip() for c in codigos_list if str(c).strip()])
    updated = 0
    enabled = 0
    disabled = 0

    # habilitar los que aparecen
    for codigo in codigos_set:
        prod = get_product_by_codigo(session, codigo)
        if prod:
            if not prod.habilitado:
                prod.habilitado = True
                session.add(prod)
                updated += 1
            enabled += 1

    if replace_others:
        # deshabilitar los que no están
        prods = session.exec(select(Product)).all()
        for p in prods:
            if p.codigo not in codigos_set and p.habilitado:
                p.habilitado = False
                session.add(p)
                disabled += 1
        updated += disabled

    session.commit()
    return {"processed": len(codigos_set), "enabled_found": enabled, "updated_total": updated, "disabled_total": disabled}

def import_ordenes_from_mapping(session, mapping: List[dict], match_by: str = "nombre"):
    """
    mapping: lista de dicts {"orden": int, "nombre": str} o {"orden": int, "codigo": str}
    match_by: "nombre" o "codigo"
    Intenta setear orden por cada fila. Retorna conteos.
    """
    updated = 0
    not_found = []
    for item in mapping:
        orden = item.get("orden", None)
        if orden is None:
            continue
        if match_by == "codigo" and item.get("codigo"):
            prod = get_product_by_codigo(session, str(item.get("codigo")).strip())
        else:
            nombre = str(item.get("nombre","")).strip()
            # intentar match exacto por nombre
            prod = get_product_by_nombre(session, nombre)
            # si no match exacto, intentar match parcial
            if not prod and nombre:
                prod = session.exec(select(Product).where(Product.nombre.ilike(f"%{nombre}%"))).first()
        if prod:
            prod.orden = int(orden)
            session.add(prod)
            updated += 1
        else:
            not_found.append(item)
    session.commit()
    return {"updated": updated, "not_found": not_found}

# ---------- Pedidos (mantengo lo que ya había) ----------
def create_order(session, order: Order, productos_data: List[dict]):
    # productos_data: lista de dicts {codigo, cantidad, precio_unitario} enviado por cliente
    order.subtotal = 0.0
    session.add(order)
    session.commit()
    session.refresh(order)

    for p in productos_data:
        cantidad = int(p.get("cantidad", 1))
        precio_unitario = float(p.get("precio_unitario", 0.0))
        codigo = p.get("codigo", "")
        nombre = p.get("nombre", "")
        subtotal_item = round(cantidad * precio_unitario, 2)
        op = OrderProduct(order_id=order.id,
                          product_id=p.get("product_id"),
                          codigo=codigo,
                          nombre=nombre,
                          cantidad=cantidad,
                          precio_unitario=precio_unitario,
                          subtotal=subtotal_item)
        session.add(op)
        order.subtotal += subtotal_item

    # calcular total server-side
    order.total = round(order.subtotal + (order.envio_cobrado or 0.0), 2)
    session.add(order)
    session.commit()
    session.refresh(order)
    return order

def update_order(session, order_id: int, data: dict):
    order = session.get(Order, order_id)
    if not order:
        return None
    # actualizar campos simples
    for key in ["dia_entrega","nombre_completo","correo","telefono","direccion","comentario","envio_cobrado","costo_envio_real","confirmado","entregado"]:
        if key in data:
            setattr(order, key, data[key])
    # si vienen productos: replace productos
    if "productos" in data:
        # borrar los existentes
        existing = session.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()
        for e in existing:
            session.delete(e)
        order.subtotal = 0.0
        for p in data["productos"]:
            cantidad = int(p.get("cantidad", 1))
            precio_unitario = float(p.get("precio_unitario", 0.0))
            subtotal_item = round(cantidad * precio_unitario, 2)
            op = OrderProduct(order_id=order.id,
                              product_id=p.get("product_id"),
                              codigo=p.get("codigo",""),
                              nombre=p.get("nombre",""),
                              cantidad=cantidad,
                              precio_unitario=precio_unitario,
                              subtotal=subtotal_item)
            session.add(op)
            order.subtotal += subtotal_item
    # recalcular total
    order.total = round(order.subtotal + (order.envio_cobrado or 0.0), 2)
    session.add(order)
    session.commit()
    session.refresh(order)
    return order

def list_orders(session):
    return session.exec(select(Order)).all()

def get_order(session, order_id: int):
    return session.get(Order, order_id)

def get_options(session):
    # obtener opciones como dias de entrega, orden de categorias, precio de envio
    from .models import ConfiguracionDias, ConfiguracionCategorias, ConfiguracionEnvio
    dias = session.exec(select(ConfiguracionDias)).all()
    orden_cats = session.exec(select(ConfiguracionCategorias)).first()
    precio_envio = session.exec(select(ConfiguracionEnvio)).first()
    return {
        "dias_entrega": dias,
        "orden_categorias": orden_cats,
        "config_envio": precio_envio
    }