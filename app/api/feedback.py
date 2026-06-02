# app/api/feedback.py
from fastapi import APIRouter, HTTPException
from app.database import get_session
from app.models import Feedback, Order
from sqlmodel import select
from datetime import datetime

router = APIRouter(prefix="/feedback", tags=["feedback"])


# ── Enviar feedback (PÚBLICO) ─────────────────────────────────────────────────
@router.post("/submit")
async def submit_feedback(payload: dict):
    """
    El cliente envía su opinión post-compra.
    Validamos que el order_id exista para evitar spam.
    """
    order_id = payload.get("order_id")

    # Verificar que el pedido exista
    if order_id:
        with get_session() as s:
            order = s.get(Order, int(order_id))
            if not order:
                raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Validar ratings
    def valid_rating(v):
        return v is None or (isinstance(v, int) and 1 <= v <= 5)

    for field in ["servicio", "calidad", "entrega", "experiencia"]:
        if not valid_rating(payload.get(field)):
            raise HTTPException(400, f"Rating inválido para '{field}'")

    fb = Feedback(
        order_id=int(order_id) if order_id else None,
        nombre=payload.get("nombre"),
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


# ── Listar feedback (PROTEGIDO) ───────────────────────────────────────────────
@router.get("/list")
def list_feedback(limit: int = 100, solo_no_leido: bool = False):
    with get_session() as s:
        q = select(Feedback).order_by(Feedback.timestamp.desc()).limit(limit)
        if solo_no_leido:
            q = q.where(Feedback.leido == False)
        items = s.exec(q).all()
        return items


# ── Marcar como leído (PROTEGIDO) ─────────────────────────────────────────────
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


# ── Estadísticas de feedback (PROTEGIDO) ──────────────────────────────────────
@router.get("/stats")
def feedback_stats():
    with get_session() as s:
        items = s.exec(select(Feedback)).all()

    if not items:
        return {"total": 0, "promedio": {}}

    def avg(field):
        vals = [getattr(i, field) for i in items if getattr(i, field) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        "total": len(items),
        "no_leidos": sum(1 for i in items if not i.leido),
        "promedio": {
            "servicio":    avg("servicio"),
            "calidad":     avg("calidad"),
            "entrega":     avg("entrega"),
            "experiencia": avg("experiencia"),
        }
    }