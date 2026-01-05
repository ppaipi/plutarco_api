from fastapi import status, APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from app.models import Product, Order, OrderProduct
from datetime import date
from sqlmodel import select
from app.database import get_session
import pandas as pd
import io
import os
import requests
from sqlmodel import Session
from fastapi import UploadFile, File
from datetime import datetime
from sqlalchemy import text


router = APIRouter(prefix="/orders", tags=["orders"])


RESEND_API_KEY = os.getenv("RESEND_API_KEY")

def enviar_mail(to: str, subject: str, html: str):
    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "from": "Plutarco Almacén - Pedidos <pedidos@plutarcoalmacen.com.ar>",
            "to": [to],
            "subject": subject,
            "html": html
        }
    )

    if response.status_code >= 400:
        print("Error enviando mail:", response.text)
        return False

    return True

def generar_html_pedido(order: Order) -> str:
    productos_html = ""
    for p in order.productos:
        productos_html += f"""
        <tr>
            <td style="padding:6px;">{p.cantidad}</td>
            <td style="padding:6px;">{p.nombre}</td>
            <td style="padding:6px; text-align:right;">${int((p.cantidad or 0) * (p.precio_unitario or 0))}</td>
        </tr>
        """
    html = f"""
    <div style="max-width: 600px; margin: 20px auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:
    #333; background: #ffffff; padding: 25px; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
        <h2 style="text-align:center;">🛍️ Detalles del Pedido | Plutarco Almacen 🥖</h2>
        <div style="background: #f7f9fc; padding: 15px 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e3e6eb;">
            <p><strong>Nombre:</strong> {order.nombre_completo}</p>
            <p><strong>Email:</strong> {order.correo}</p>
            <p><strong>Teléfono:</strong> {order.telefono}</p>
            <p><strong>Dirección:</strong> {order.direccion}</p>
            <p><strong>Día de entrega:</strong> {order.dia_entrega}</p>
            {"<p><strong>Comentario:</strong> " + order.comentario + "</p>" if order.comentario else ""}
        </div>
        <table style="width:100%; border-collapse: collapse; font-size: 15px; margin-top:10px; margin-bottom:10px;">
            <thead>
                <tr style="background:#f5f5f5;">
                    <th style="text-align:left; padding:6px;">Cant.</th>
                    <th style="text-align:left; padding:6px;">Producto</th>
                    <th style="text-align:right; padding:6px;">Precio</th>
                </tr>
            </thead>
            <tbody>
                {productos_html}
            </tbody>
        </table>
        <div style="margin-top: 20px;">
        <table style="width:100%; border-collapse: collapse; font-size: 15px;">
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">Subtotal:</td>
                <td style="padding: 8px; text-align:right; border-bottom: 1px solid #ddd;"><strong>${int(order.subtotal)}</strong></td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">Envío:</td>
                <td style="padding: 8px; text-align:right; border-bottom: 1px solid #ddd;"><strong>${int(order.envio_cobrado)}</strong></td>
            </tr>
            <tr>
                <td style="padding: 10px; font-size: 1.1em; font-weight: bold;">TOTAL:</td>
                <td style="padding: 10px; text-align:right; font-size: 1.1em; font-weight: bold; color: #1e88e5;">${int(order.total)}</td>
            </tr>
        </table>
        </div>
        <div style="background: #fff3cd; padding: 16px; border-left: 5px solid #ffcc00; margin-top: 30px; border-radius: 8px;">
            <h4 style="margin-top: 0;">💸 Información para el pago</h4>
            <p>Por favor, transferí <strong>${order.total}</strong> al alias <strong>plutarco.almacen</strong></p>
            <p>Cuenta a nombre de <strong>Dario Chapur</strong>.</p>
            <p>Una vez realizado el pago, te pedimos que envíes el comprobante a este mismo correo electrónico o a nuestro whatsapp: <a href="https://wa.me/5491150168920?text=Hola Plutarco Almacén! Realicé un pedido de *${order.total}* a nombre de *{order.nombre_completo}*"> 11 5016-8920.</p>
            <p>Confirmaremos tu pedido una vez recibido el comprobante.</p>
        </div>
        <div style="margin-top: 30px; background: #e2e3e5; padding: 14px; border-left: 5px solid #6c757d; border-radius: 8px;">
            <p>⚠️ En caso de no contar con stock de algún producto, se te notificará y se realizará la devolución del monto correspondiente.</p>
        </div>
    </div>
    """
    return html



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
        dia_pedido=date.today(),
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
        # enviar mail de confirmación
        html_pedido = generar_html_pedido(order)
        enviar_mail(order.correo, "✅ Pedido Recibido - Plutarco Almacén", html_pedido)

        #enviar mail a admin
        enviar_mail("plutarcoalmacen@gmail.com", f"Nuevo pedido de {order.nombre_completo}", html_pedido)

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
@router.get("/list")
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
@router.delete("/delete/all", status_code=204)
def api_delete_all():
    try:
        with get_session() as s:
            # borrar hijos primero
            s.exec(text('DELETE FROM orderproduct'))
            s.exec(text('DELETE FROM "order"'))
            s.commit()

        return {"ok": True, "message": "Todos los pedidos eliminados"}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

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

                dia_entrega_raw = row.get("dia de entrega", "")
                hora_envio_raw = row.get("Hora de envio", "")
                costo_envio_real = row.get("COSTO ENVIO", 0)
                envio_cobrado = row.get("Envio", 0)
                try:
                    envio_cobrado = float(str(envio_cobrado).replace("$", "").replace(".", "").replace(",", "."))
                except:
                    envio_cobrado = 0
                try:
                    costo_envio_real = float(str(costo_envio_real).replace("$", "").replace(".", "").replace(",", "."))
                except:
                    costo_envio_real = 0
                try:
                    dia_entrega = (
                        pd.to_datetime(dia_entrega_raw, format="%d/%m/%Y").date()
                        if dia_entrega_raw else None
                    )
                except:
                    dia_entrega = None
                try:
                    """ 04/09/2025 17:51:08 """

                    hora_envio = (
                        datetime.strptime(hora_envio_raw, "%d/%m/%Y %H:%M:%S")
                        if hora_envio_raw else None
                    )
                except:
                    hora_envio = None

                subtotal = (
                    row.get("Subtotal") or 0
                )
                try:
                    subtotal = float(str(subtotal).replace("$", "").replace(".", "").replace(",", "."))
                except:
                    subtotal = 0

                order = Order(
                    nombre_completo=nombre,
                    correo=email,
                    telefono=str(row.get("Telefono", "")),
                    direccion=str(row.get("Direccion", "")),
                    comentario=str(row.get("Comentario", "")),
                    dia_entrega=dia_entrega,
                    dia_pedido=hora_envio,
                    envio_cobrado=int(envio_cobrado),
                    costo_envio_real=int(costo_envio_real),
                    confirmado=str(row.get("confirmado y pagado", "")).strip().upper()=="TRUE",
                    entregado=str(row.get("entregado", "")).strip().upper()=="TRUE",
                    subtotal=int(subtotal),
                    total=int(subtotal + envio_cobrado),
                )

                s.add(order)
                s.commit()
                s.refresh(order)

                op = OrderProduct(
                    codigo="GENERICO",
                    order_id=order.id,
                    nombre="PRODUCTO GENERICO",
                    cantidad=1,
                    precio_unitario=int(subtotal)
                )
                s.add(op)
                s.commit()

                created += 1

            except Exception as e:
                errors.append(f"Fila {idx+1}: {str(e)}")

    return {"created": created, "errors": errors}

def generar_html_imprimir(order: Order) -> str:
    productos_html = ""
    for p in order.productos:
        productos_html += f"""
        <tr>
            <td style="padding:6px;">{p.cantidad}</td>
            <td style="padding:6px;">{p.nombre}</td>
            <td style="padding:6px; text-align:right;">${int((p.cantidad or 0) * (p.precio_unitario or 0))}</td>
        </tr>
        """
    html = f"""
    <html>
    <head>
        <title>Pedido #{order.id} - Plutarco Almacén</title>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #333;
                max-width: 800px;
                margin: 20px auto;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                font-size: 15px;
                margin-top: 10px;
                margin-bottom: 10px;
            }}
            th, td {{
                padding: 6px;
                border-bottom: 1px solid #ddd;
            }}
            th {{
                background: #f5f5f5;
                text-align: left;
            }}
        </style>
    </head>
    <body>
        <h2 style="text-align:center;">🛍️ Detalles del Pedido | Plutarco Almacén 🥖</h2>
        <div>
            <p><strong>Nombre:</strong> {order.nombre_completo}</p>
            <p><strong>Email:</strong> {order.correo}</p>
            <p><strong>Teléfono:</strong> {order.telefono}</p>
            <p><strong>Dirección:</strong> {order.direccion}</p>
            <p><strong>Día de entrega:</strong> {order.dia_entrega}</p>
            {"<p><strong>Comentario:</strong> " + order.comentario + "</p>" if order.comentario else ""}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Cant.</th>
                    <th>Producto</th>
                    <th style="text-align:right;">Precio</th>
                </tr>
            </thead>
            <tbody>
                {productos_html}
            </tbody>
        </table>
        <div>
        <table>
            <tr>
                <td>Subtotal:</td>
                <td style="text-align:right;"><strong>${int(order.subtotal)}</strong></td>
            </tr>
            <tr>
                <td>Envío:</td>
                <td style="text-align:right;"><strong>${int(order.envio_cobrado)}</strong></td>
            </tr>
            <tr>
                <td><strong>TOTAL:</strong></td>
                <td style="text-align:right; font-size: 1.1em; font-weight: bold; color: #1e88e5;"><strong>${int(order.total)}</strong></td>
            </tr>
        </table>
        </div>
    </body>
    </html>
    """
    return html

@router.get("/print/{order_id}", response_class=HTMLResponse)
def api_print_order(order_id: int):
    with get_session() as s:
        order = s.get(Order, order_id)
        if not order:
            raise HTTPException(404)

        html_pedido = generar_html_imprimir(order)
        return html_pedido