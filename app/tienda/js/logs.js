// app/tienda/js/analytics.js
// ─────────────────────────────────────────────────────────────
// Tracker de eventos del cliente (estilo api.js)
// ─────────────────────────────────────────────────────────────

const BASE = 'https://plutarco-api.fly.dev';
const ANALYTICS_URL = `${BASE}/log/event`;

const SESSION_KEY = 'plutarco_session';

// ─── Session ID ───────────────────────────────────────────────

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// ─── helper interno (opcional pero mantiene orden) ────────────

async function sendEvent(payload) {
  try {
    const res = await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    // opcional: debug silencioso si algo falla
    if (!res.ok) {
      console.warn('Analytics error:', res.status);
    }
  } catch (_) {
    // falla silenciosamente
  }
}

// ─── Eventos ──────────────────────────────────────────────────

export async function trackPageView() {
  return sendEvent({
    event_type: 'page_view',
    session_id: getSessionId(),
  });
}

export async function trackCartAdd(productId, productName) {
  return sendEvent({
    event_type: 'cart_add',
    session_id: getSessionId(),
    product_id: productId,
    product_name: productName,
  });
}

export async function trackCartOpen() {
  return sendEvent({
    event_type: 'cart_open',
    session_id: getSessionId(),
  });
}

export async function trackOrderPlaced(orderId) {
  return sendEvent({
    event_type: 'order_placed',
    session_id: getSessionId(),
    order_id: orderId,
  });
}