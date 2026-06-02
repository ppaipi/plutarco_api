# app/api/analytics.py
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.database import get_session
from app.models import AnalyticsEvent
from sqlmodel import select, func
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import text

router = APIRouter(prefix="/log", tags=["log"])


# ── Registrar un evento (PÚBLICO, sin auth) ───────────────────────────────────
@router.post("/event")
async def track_event(payload: dict):
    """
    Recibe eventos desde el frontend de la tienda.
    No requiere autenticación — es llamado por el browser del cliente.

    Payload esperado:
    {
        "event_type": "page_view" | "cart_add" | "cart_open" | "order_placed",
        "session_id": "abc123",
        "product_id":   "opcional",
        "product_name": "opcional",
        "order_id":     opcional int
    }
    """
    allowed = {"page_view", "cart_add", "cart_open", "order_placed"}
    event_type = payload.get("event_type", "")
    if event_type not in allowed:
        return JSONResponse({"ok": False, "error": "event_type inválido"}, status_code=400)

    event = AnalyticsEvent(
        event_type=event_type,
        session_id=payload.get("session_id"),
        product_id=str(payload["product_id"])  if payload.get("product_id")   else None,
        product_name=payload.get("product_name"),
        order_id=int(payload["order_id"])       if payload.get("order_id")     else None,
    )

    with get_session() as s:
        s.add(event)
        s.commit()

    return {"ok": True}


# ── Resumen general (PROTEGIDO — requiere x-api-key) ─────────────────────────
@router.get("/summary")
def get_summary(days: int = 30):
    """
    Devuelve métricas agregadas para el panel de admin.
    """
    since = datetime.utcnow() - timedelta(days=days)

    with get_session() as s:
        # Totales del periodo
        def count_event(etype):
            return s.exec(
                select(func.count(AnalyticsEvent.id))
                .where(AnalyticsEvent.event_type == etype)
                .where(AnalyticsEvent.timestamp >= since)
            ).one()

        page_views    = count_event("page_view")
        cart_adds     = count_event("cart_add")
        cart_opens    = count_event("cart_open")
        orders_placed = count_event("order_placed")

        # Sesiones únicas (visitantes únicos aproximados)
        unique_sessions = s.exec(
            select(func.count(func.distinct(AnalyticsEvent.session_id)))
            .where(AnalyticsEvent.event_type == "page_view")
            .where(AnalyticsEvent.timestamp >= since)
        ).one()

        # Conversión
        conv_cart  = round(cart_opens  / page_views * 100, 1) if page_views else 0
        conv_order = round(orders_placed / page_views * 100, 1) if page_views else 0

        # Por día (últimos `days` días)
        daily_raw = s.exec(
            select(
                func.date(AnalyticsEvent.timestamp).label("day"),
                AnalyticsEvent.event_type,
                func.count(AnalyticsEvent.id).label("cnt")
            )
            .where(AnalyticsEvent.timestamp >= since)
            .group_by(func.date(AnalyticsEvent.timestamp), AnalyticsEvent.event_type)
            .order_by(func.date(AnalyticsEvent.timestamp))
        ).all()

        # Organizar por día
        daily_map: dict = {}
        for row in daily_raw:
            day_str = str(row.day)
            if day_str not in daily_map:
                daily_map[day_str] = {
                    "date": day_str,
                    "page_view": 0, "cart_add": 0,
                    "cart_open": 0, "order_placed": 0
                }
            daily_map[day_str][row.event_type] = row.cnt

        daily = sorted(daily_map.values(), key=lambda x: x["date"])

        # Top 10 productos más agregados al carrito
        top_products_raw = s.exec(
            select(
                AnalyticsEvent.product_name,
                func.count(AnalyticsEvent.id).label("cnt")
            )
            .where(AnalyticsEvent.event_type == "cart_add")
            .where(AnalyticsEvent.timestamp >= since)
            .where(AnalyticsEvent.product_name != None)
            .group_by(AnalyticsEvent.product_name)
            .order_by(func.count(AnalyticsEvent.id).desc())
            .limit(10)
        ).all()

        top_products = [{"name": r.product_name, "count": r.cnt} for r in top_products_raw]

    return {
        "period_days": days,
        "totals": {
            "page_views":      page_views,
            "unique_sessions": unique_sessions,
            "cart_adds":       cart_adds,
            "cart_opens":      cart_opens,
            "orders_placed":   orders_placed,
        },
        "conversion": {
            "cart_rate":  conv_cart,   # % de visitas que abren carrito
            "order_rate": conv_order,  # % de visitas que compran
        },
        "daily":        daily,
        "top_products": top_products,
    }