# app/crud.py
from sqlmodel import select
from .models import Product, Order, OrderProduct
from .database import get_session
from typing import List

def create_product(session, product: Product):
    session.add(product)
    session.commit()
    session.refresh(product)
    return product

def get_products(session) -> List[Product]:
    return session.exec(select(Product)).all()

def get_product_by_codigo(session, codigo: str):
    return session.exec(select(Product).where(Product.codigo == codigo)).first()

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
