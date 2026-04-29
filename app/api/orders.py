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
from app.config import RESEND_API_KEY


router = APIRouter(prefix="/orders", tags=["orders"])



def enviar_mail(to: str, subject: str, html: str):
    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "from": "Plutarco Almacén Pedidos <pedidos@plutarcoalmacen.com.ar>",
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

    # --- Productos ---
    productos_html = ""
    for p in order.productos:
        subtotal = (p.precio_unitario or 0) * (p.cantidad or 0)

        productos_html += f"""
        <table width="100%" style="border-bottom:1px solid #e6e0d4;padding:8px 0;">
          <tr>

            <td width="40" align="center">
              <div style="
                background:#1A5C78;
                color:#fff;
                border-radius:50%;
                width:22px;
                height:22px;
                line-height:22px;
                font-size:0.7rem;
                font-weight:700;
                margin:auto;
              ">
                {p.cantidad}
              </div>
            </td>

            <td style="padding-left:8px;">
              <div style="font-size:0.84rem;color:#333;">
                {p.nombre}
              </div>
              <div style="font-size:0.75rem;color:#6b7280;">
                ${p.precio_unitario:,.0f} c/u
              </div>
            </td>

            <td align="right" style="white-space:nowrap;">
              <div style="font-size:0.88rem;font-weight:700;color:#124460;">
                ${subtotal:,.0f}
              </div>
            </td>

          </tr>
        </table>
        """

    wsp_texto = f"Hola Plutarco Almacén! Realicé el pedido #{order.id} de ${order.total:,.0f} a nombre de {order.nombre_completo}"

    # --- HTML ---
    html = f"""
<div style="max-width:580px;margin:24px auto;font-family:'Quicksand','Inter',sans-serif;">

  <!-- HEADER -->
  <table width="100%" style="background:#1A5C78;border-radius:14px 14px 0 0;padding:18px 22px;">
    <tr>

      <td width="50">
        <img src="https://plutarcoalmacen.com.ar/media_static/iconpng.ico" style="width:36px;height:36px;">
      </td>

      <td style="color:#fff;">
        <div style="font-size:0.95rem;font-weight:700;">Plutarco Almacén</div>
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.6);">Coghlan · CABA</div>
      </td>

      <td align="right">
        <div style="background:#C8863A;color:#fff;font-size:0.75rem;font-weight:700;padding:4px 12px;border-radius:20px;display:inline-block;">
          Pedido #{order.id}
        </div>
      </td>

    </tr>
  </table>

  <!-- BODY -->
  <div style="background:#fff;padding:20px 22px;border-left:1px solid #d4ccbf;border-right:1px solid #d4ccbf;">

    <!-- SUCCESS -->
    <div style="text-align:center;padding:18px 0;">
      <div style="
        width:50px;
        height:50px;
        background:#eaf7ef;
        border-radius:50%;
        margin:0 auto 12px;
        font-size:22px;
        color:#27ae60;
        text-align:center;
        line-height:50px;
        font-weight:700;
      ">✓</div>

      <h2 style="font-size:1.05rem;color:#124460;margin-bottom:6px;">
        ¡Tu pedido fue recibido!
      </h2>

      <p style="font-size:0.84rem;color:#6b7280;">
        Confirmamos al recibir el pago.
      </p>
    </div>

    <hr style="border-top:1px solid #e6e0d4;margin:16px 0;">

    <!-- DATOS -->
    <div style="font-size:0.7rem;font-weight:700;color:#1A5C78;margin-bottom:10px;">
      Datos de entrega
    </div>

    <div style="background:#F4F0E8;padding:10px;border-radius:8px;margin-bottom:6px;">
      <b>Nombre:</b> {order.nombre_completo}
    </div>

    <div style="background:#F4F0E8;padding:10px;border-radius:8px;margin-bottom:6px;">
      <b>Teléfono:</b> {order.telefono}
    </div>

    <div style="background:#F4F0E8;padding:10px;border-radius:8px;margin-bottom:6px;">
      <b>Día:</b> {recompute_date_args(order.dia_entrega)}
    </div>

    <div style="background:#F4F0E8;padding:10px;border-radius:8px;margin-bottom:6px;">
      <b>Email:</b> {order.correo}
    </div>

    <div style="background:#F4F0E8;padding:10px;border-radius:8px;margin-bottom:6px;">
      <b>Dirección:</b> {order.direccion}
    </div>
    
    <div style="background:#F4F0E8;padding:10px;border-radius:8px;margin-bottom:6px;">
      <b>Comentario:</b> {order.comentario}
    </div>
    

    <hr style="border-top:1px solid #e6e0d4;margin:16px 0;">

    <!-- PRODUCTOS -->
    <div style="font-size:0.7rem;font-weight:700;color:#1A5C78;margin-bottom:10px;">
      Productos
    </div>

    {productos_html}

    <hr style="border-top:1px solid #e6e0d4;margin:16px 0;">

    <!-- Totales -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; padding:20px; border-radius:12px; font-family:Arial, sans-serif;">
  <tr>
    <td style="font-size:14px; color:#666; padding-bottom:8px;">
      Subtotal
    </td>
    <td align="right" style="font-size:14px; color:#666; padding-bottom:8px;">
      ${order.subtotal}
    </td>
  </tr>

  <tr>
    <td style="font-size:14px; color:#666; padding-bottom:8px;">
      Envío
    </td>
    <td align="right" style="font-size:14px; color:#666; padding-bottom:8px;">
      ${order.envio_cobrado}
    </td>
  </tr>

  <tr>
    <td colspan="2" style="padding-top:12px; border-top:2px solid #e6e0d4;"></td>
  </tr>

  <tr>
    <td style="font-size:18px; font-weight:bold; color:#124460; padding-top:8px;">
      Total
    </td>
    <td align="right" style="font-size:18px; font-weight:bold; color:#124460; padding-top:8px;">
      ${order.total}
    </td>
  </tr>
</table>

    <hr style="  border: none;
        border-top: 1px solid #eee6d8;
        margin: 24px 0;">
 
    <!-- Info de pago -->
    <div style="  background: #FFF9F2;
        border-left: 5px solid #C8863A;
        border-radius: 4px 12px 12px 4px;
        padding: 20px;
        margin: 10px 0;">
      <h4 style="  font-size: 0.95rem;
        font-weight: 700;
        color: #7c4d10;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;">💸 Información de pago</h4>
      <p style="  font-size: 0.88rem;
        color: #7c4d10;
        line-height: 1.6;">Transferí <strong style="color: #8a5e28;">${(order.total)}</strong> al alias <strong>plutarco.almacen</strong> <br>
        Cuenta a nombre de <strong style="color: #8a5e28;">Darío Chapur</strong>.<br>
        Envianos el comprobante por
        <a href="https://wa.me/5491150168920?text={wsp_texto}" target="_blank" style="color: #C8863A; font-weight: 700; text-decoration: none; border-bottom: 1.5px solid ##c8863a;">
          WhatsApp al 11 5016-8920
        </a>
        o respondé el email de confirmación. Confirmamos tu pedido al recibirlo.
      </p>
    </div>
 
    <!-- Aviso stock -->
    <div style="  background: #f9f9f9;
        border-radius: 8px;
        padding: 12px 16px;
        border: 1px dashed #ccc;
        margin-top: 15px;
        ">
      <p style="  font-size: 0.8rem;
        color: #777;
        text-align: center;">⚠️ Si algún producto no tiene stock, te avisamos y hacemos la devolución del monto correspondiente.</p>
    </div>
 
  </div>
 
  <!-- FOOTER -->
  <div style="  background: #124460;
    border-radius: 0 0 16px 16px;
    padding: 30px;
    text-align: center;">
    <p style="color: #fff;
        font-size: 0.85rem;
        margin-bottom: 20px;">¿Consultas? Escribinos por WhatsApp o respondé el email de confirmación.</p>
    <a href="https://wa.me/5491150168920?text={wsp_texto}" target="_blank" style="color: #C8863A; font-weight: 700; text-decoration: none; border-bottom: 1.5px solid rgba(200, 134, 58, 0.3);">
    <button style="  background: #25D366;
        color: #fff;
        border: none;
        padding: 12px 32px;
        border-radius: 25px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s, opacity 0.8s;
        ">
      Consultar por WhatsApp
    </button>
    </a>
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

def recompute_date_args(value):
    """
    Acepta str, date o datetime y devuelve 'DD/MM/YYYY'
    """
    if not value:
        return None

    try:
        if isinstance(value, str):
            dt = datetime.strptime(value[:10], "%Y-%m-%d")
        elif isinstance(value, (datetime, date)):
            dt = value
        else:
            return None

        return dt.strftime("%d/%m/%Y")
    except Exception:
        return None




@router.post("/")
def api_create_order(payload: dict):

    # fecha
    if payload.get("dia_entrega"):
        payload["dia_entrega"] = date.fromisoformat(payload["dia_entrega"])
    if payload.get("dia_pedido"):
        payload["dia_pedido"] = date.fromisoformat(payload["dia_pedido"])
    else:
        payload["dia_pedido"] = date.today()

    order = Order(
        nombre_completo=payload["nombre_completo"],
        correo=payload["correo"],
        telefono=payload.get("telefono", ""),
        direccion=payload.get("direccion", ""),
        comentario=payload.get("comentario", ""),
        dia_entrega=payload.get("dia_entrega"),
        dia_pedido=payload.get("dia_pedido"),
        envio_cobrado=float(payload.get("envio_cobrado", 0)),
        costo_envio_real=float(payload.get("costo_envio_real", 0)),
        confirmado=bool(payload.get("confirmado", False)),
        entregado=bool(payload.get("entregado", False)),
        empleado_asignado=payload.get("empleado_asignado", ["0","1"])
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
        if(order.correo):
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
        if payload.get("dia_pedido"):
            try:
                order.dia_pedido = date.fromisoformat(payload["dia_pedido"])
            except:
                raise HTTPException(400, "Fecha de pedido inválida")

        order.nombre_completo = payload.get("nombre_completo", order.nombre_completo)
        order.correo = payload.get("correo", order.correo)
        order.telefono = payload.get("telefono", order.telefono)
        order.direccion = payload.get("direccion", order.direccion)
        order.comentario = payload.get("comentario", order.comentario)
        order.envio_cobrado = int(payload.get("envio_cobrado", order.envio_cobrado))
        order.costo_envio_real = int(payload.get("costo_envio_real", order.costo_envio_real))
        order.confirmado = bool(payload.get("confirmado", order.confirmado))
        order.entregado = bool(payload.get("entregado", order.entregado))
        order.empleado_asignado = payload.get("empleado_asignado", order.empleado_asignado)
        productos = payload.get("productos", [])

        # -------------------------
        # REEMPLAZAR PRODUCTOS
        # -------------------------
        # borrar productos anteriores
        old_items = s.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()
        for it in old_items:
            s.delete(it)
        s.commit()

        # cargar nuevos ítems
        for p in productos:
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

        productos = s.exec(select(OrderProduct).where(OrderProduct.order_id == order.id)).all()

        return {"order": order, "productos": productos}


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


@router.post("/{order_id}/toggle-confirmed")
def api_toggle_order_confirmed(order_id: int):
    with get_session() as s:
        order = s.get(Order, order_id)
        if not order:
            raise HTTPException(404)

        order.confirmado = not order.confirmado
        s.commit()

        return {"confirmado": order.confirmado}
@router.post("/{order_id}/toggle-delivered")
def api_toggle_order_delivered(order_id: int):
    with get_session() as s:
        order = s.get(Order, order_id)
        if not order:
            raise HTTPException(404)

        order.entregado = not order.entregado
        s.commit()

        return {"entregado": order.entregado}

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
                    envio_cobrado = int(str(envio_cobrado).replace("$", "").replace(".", "").replace(",", "."))
                except:
                    envio_cobrado = 0
                try:
                    costo_envio_real = int(str(costo_envio_real).replace("$", "").replace(".", "").replace(",", "."))
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
                    subtotal = int(str(subtotal).replace("$", "").replace(".", "").replace(",", "."))
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
                    empleado_asignado=[1,2]
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
            <td style="padding:6px;">${int(p.precio_unitario or 0)}</td>
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
            <p><strong>Día de entrega:</strong> {recompute_date_args(order.dia_entrega)}</p>
            {"<p><strong>Comentario:</strong> " + order.comentario + "</p>" if order.comentario else ""}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Cant.</th>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th style="text-align:right;">Total</th>
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