from fastapi import status, APIRouter, HTTPException, Query
from app.models import Product, Order, OrderProduct
from datetime import date
from sqlmodel import select
from app.database import get_session
import pandas as pd
import io
from sqlmodel import Session
from fastapi import UploadFile, File



router = APIRouter(prefix="/orders", tags=["orders"])


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




@router.post("/")
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
@router.put("/{order_id}")
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
@router.get("/")
def api_get_orders():
    with get_session() as s:
        return s.exec(select(Order)).all()


@router.get("/{order_id}")
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
@router.delete("/{order_id}/items/{item_id}")
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
@router.delete("/{order_id}")
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
@router.delete("/delete/all")
def api_delete_all():
    with get_session() as s:
        s.exec("DELETE FROM orderproduct")
        s.exec("DELETE FROM 'order'")
        s.commit()
        return {"ok": True, "message": "Todos los pedidos eliminados"}


# -------------------------
# IMPORTAR PEDIDOS DESDE EXCEL
# -------------------------
@router.post("/import-excel")
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
