# app/api/feedback.py
import os, hmac, hashlib, base64
from fastapi import APIRouter, HTTPException
from app.database import get_session
from app.models import Feedback, Order
from sqlmodel import select
import requests as http_requests

router = APIRouter(prefix="/feedback", tags=["feedback"])

FEEDBACK_SECRET = os.getenv("FEEDBACK_SECRET", "plutarco-fb-secret-2026")
RESEND_API_KEY  = os.getenv("RESEND_API_KEY", "")
BASE_URL        = "https://plutarcoalmacen.com.ar"


# ══════════════════════════════════════════════════════════════════
#  TOKEN — genera un código opaco por pedido con HMAC-SHA256
#  /feedback?t=MTIzOmFiY2QxMjM0  → nadie puede adivinar el order_id
# ══════════════════════════════════════════════════════════════════

def generate_token(order_id: int) -> str:
    mac = hmac.new(
        FEEDBACK_SECRET.encode(),
        str(order_id).encode(),
        hashlib.sha256
    ).hexdigest()[:16]
    raw = f"{order_id}:{mac}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def parse_token(token: str):
    """Devuelve order_id (int) si el token es válido, None si no lo es."""
    try:
        padded = token + "=" * (4 - len(token) % 4)
        raw    = base64.urlsafe_b64decode(padded).decode()
        parts  = raw.split(":")
        if len(parts) != 2:
            return None
        order_id_str, mac = parts
        order_id = int(order_id_str)
        expected = hmac.new(
            FEEDBACK_SECRET.encode(),
            str(order_id).encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        return order_id if hmac.compare_digest(expected, mac) else None
    except Exception:
        return None


# ── Generar token/link (PROTEGIDO — admin) ────────────────────────
@router.get("/token/{order_id}")
def get_token(order_id: int):
    token = generate_token(order_id)
    return {"token": token, "url": f"{BASE_URL}/feedback?t={token}"}


# ── Validar token (PÚBLICO — lo llama el browser al abrir el form) ─
@router.get("/verify")
def verify(t: str):
    order_id = parse_token(t)
    if order_id is None:
        raise HTTPException(400, "Link inválido o expirado.")

    with get_session() as s:
        existing = s.exec(
            select(Feedback).where(Feedback.order_id == order_id)
        ).first()
    if existing:
        raise HTTPException(409, "Ya enviaste tu opinión para este pedido.")

    return {"ok": True, "order_id": order_id}


# ── Enviar feedback (PÚBLICO) ─────────────────────────────────────
@router.post("/submit")
async def submit_feedback(payload: dict):
    token = payload.get("token", "")
    order_id = parse_token(token)
    if order_id is None:
        raise HTTPException(400, "Link inválido o expirado.")

    # Un solo feedback por pedido
    with get_session() as s:
        if s.exec(select(Feedback).where(Feedback.order_id == order_id)).first():
            raise HTTPException(409, "Ya enviaste tu opinión para este pedido.")

    # Validar ratings 1-5
    for field in ["servicio", "calidad", "entrega", "experiencia"]:
        v = payload.get(field)
        if v is not None and not (isinstance(v, int) and 1 <= v <= 5):
            raise HTTPException(400, f"Rating inválido: {field}")

    fb = Feedback(
        order_id=order_id,
        servicio=payload.get("servicio"),
        calidad=payload.get("calidad"),
        entrega=payload.get("entrega"),
        experiencia=payload.get("experiencia"),
        comentario=payload.get("comentario"),
    )
    with get_session() as s:
        s.add(fb)
        s.commit()
        s.refresh(fb)

    return {"ok": True, "id": fb.id}


# ── Enviar mail pidiendo feedback (PROTEGIDO — admin) ─────────────
@router.post("/request/{order_id}")
def request_feedback(order_id: int):
    with get_session() as s:
        order = s.get(Order, order_id)

        if not order:
            raise HTTPException(404, "Pedido no encontrado.")

        if not order.correo:
            raise HTTPException(400, "El pedido no tiene email registrado.")

        if order.feedback_recibido:
            raise HTTPException(400, "Este pedido ya tiene feedback registrado.")

        correo = order.correo
        feedback_recibido = order.feedback_recibido

    token = generate_token(order_id)
    url   = f"{BASE_URL}/feedback?t={token}"
    html  = _build_email(order, url)  

    if not _send_mail(
        to=correo,
        subject=f"🌟 ¿Cómo estuvo tu pedido #{order_id}? | Plutarco Almacén",
        html=html,
    ):
        raise HTTPException(500, "Error enviando el mail. Revisá RESEND_API_KEY.")

    with get_session() as s:
        order = s.get(Order, order_id)
        if order:
            order.feedback_recibido = True
            s.commit()

    return {"ok": True, "url": url, "sent_to": correo}

# ── Eliminar feedback (PROTEGIDO — admin) ─────────────────────────
@router.delete("/{feedback_id}")
def delete_feedback(feedback_id: int):
    with get_session() as s:
        fb = s.get(Feedback, feedback_id)
        if not fb:
            raise HTTPException(404, "Feedback no encontrado.")
        s.delete(fb)
        s.commit()
    return {"ok": True}


# ── Marcar como leído (PROTEGIDO) ────────────────────────────────
@router.post("/{feedback_id}/read")
def mark_read(feedback_id: int):
    with get_session() as s:
        fb = s.get(Feedback, feedback_id)
        if not fb:
            raise HTTPException(404)
        fb.leido = True
        s.add(fb)
        s.commit()
    return {"ok": True}


# ── Listar (PROTEGIDO) ────────────────────────────────────────────
@router.get("/list")
def list_feedback(limit: int = 100, solo_no_leido: bool = False):
    with get_session() as s:
        q = select(Feedback).order_by(Feedback.timestamp.desc()).limit(limit)
        if solo_no_leido:
            q = q.where(Feedback.leido == False)
        return s.exec(q).all()


# ── Stats (PROTEGIDO) ─────────────────────────────────────────────
@router.get("/stats")
def feedback_stats():
    with get_session() as s:
        items = s.exec(select(Feedback)).all()
    if not items:
        return {"total": 0, "no_leidos": 0, "promedio": {}}

    def avg(field):
        vals = [getattr(i, field) for i in items if getattr(i, field) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        "total":     len(items),
        "no_leidos": sum(1 for i in items if not i.leido),
        "promedio": {
            "servicio":    avg("servicio"),
            "calidad":     avg("calidad"),
            "entrega":     avg("entrega"),
            "experiencia": avg("experiencia"),
        },
    }


# ══════════════════════════════════════════════════════════════════
#  HELPERS PRIVADOS
# ══════════════════════════════════════════════════════════════════

def _send_mail(to: str, subject: str, html: str) -> bool:
    try:
        res = http_requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type":  "application/json",
            },
            json={
                "from":    "Plutarco Almacén <pedidos@plutarcoalmacen.com.ar>",
                "to":      [to],
                "subject": subject,
                "html":    html,
            },
        )
        return res.status_code < 400
    except Exception:
        return False


def _build_email(order, feedback_url: str) -> str:
    nombre = (order.nombre_completo or "").split()[0] or "cliente"
    return f"""
<div style="max-width:520px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">

  <div style="background:#1A5C78;border-radius:14px 14px 0 0;padding:20px 24px;">
    <table width="100%"><tr>
      <td width="48">
        <img src="https://plutarcoalmacen.com.ar/media_static/iconpng.ico"
             style="width:36px;height:36px;border-radius:6px;">
      </td>
      <td>
        <div style="color:#fff;font-weight:700;font-size:0.95rem;">Plutarco Almacén</div>
        <div style="color:rgba(255,255,255,0.65);font-size:0.72rem;">Coghlan · CABA</div>
      </td>
    </tr></table>
  </div>

  <div style="background:#fff;padding:32px 28px;border:1px solid #e6e0d4;border-top:none;">

    <div style="font-size:2.5rem;text-align:center;margin-bottom:12px;">🌟</div>

    <h2 style="text-align:center;color:#124460;font-size:1.2rem;margin-bottom:10px;">
      ¡Hola {nombre}! ¿Cómo estuvo tu pedido?
    </h2>

    <p style="text-align:center;color:#6b7280;font-size:0.88rem;line-height:1.7;margin-bottom:28px;">
      Tu pedido <strong>#{order.id}</strong> ya fue entregado 🎉<br>
      Nos gustaría saber cómo fue tu experiencia.<br>
      Son solo 4 preguntas — menos de un minuto.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="{feedback_url}"
         style="display:inline-block;background:#1A5C78;color:#fff;
                padding:15px 40px;border-radius:50px;text-decoration:none;
                font-weight:700;font-size:1rem;
                box-shadow:0 4px 16px rgba(26,92,120,0.25);">
        ⭐ Dejar mi opinión
      </a>
    </div>

    <div style="background:#f9f6f1;border-radius:10px;padding:14px;
                border-left:4px solid #C8863A;font-size:0.8rem;color:#888;">
      Este es un mail automatico. Agradecemos mucho tu tiempo y tu opinión, nos ayuda a mejorar cada día!
    </div>

  </div>

  <div style="background:#124460;border-radius:0 0 14px 14px;
              padding:16px;text-align:center;">
    <p style="color:rgba(255,255,255,0.5);font-size:0.75rem;margin:0;">
      © 2026 Plutarco Almacén · Coghlan, Buenos Aires
    </p>
  </div>

</div>
"""