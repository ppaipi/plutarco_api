// ─── cart.js ──────────────────────────────────────────────────────────────────

import {
  cart, products, costoEnvioActual, cantidadMinima,
  lastAddToCart,
  setPedidoMinimo, setLastAddToCart,
  saveCartToSession,
  WA_NUMBER,
} from './state.js';
import { escapeHtml, Ocultar, Mostrar } from './utils.js';

// ── Animación del ícono de carrito ────────────────────────────────────────────
export function animarCarrito() {
  const icon = document.getElementById('cart-icon');
  if (!icon) return;
  icon.classList.remove('cart-animate');
  void icon.offsetWidth;
  icon.classList.add('cart-animate');
}

function animateCartCount() {
  const count = document.getElementById('cart-count');
  if (!count) return;
  count.style.transform  = 'scale(1.3)';
  count.style.transition = 'transform 0.2s';
  setTimeout(() => { count.style.transform = 'scale(1)'; }, 200);
}

// ── Pulso periódico cuando hay productos en carrito ───────────────────────────
setInterval(() => {
  if (Object.keys(cart).length > 0 && Date.now() - lastAddToCart >= 10000) {
    animarCarrito();
    animateCartCount();
    setLastAddToCart(Date.now());
  }
}, 5000);

// ── Agregar / quitar ──────────────────────────────────────────────────────────
export function addToCart(codigo) {
  setLastAddToCart(Date.now());
  cart[codigo] = (cart[codigo] || 0) + 1;
  updateProductCard(codigo);
  _recalcularEnvio();
  animarCarrito();
  animateCartCount();
  _ocultarErrorCarrito();
}

export function updateQuantity(codigo, delta) {
  cart[codigo] = (cart[codigo] || 0) + delta;
  if (cart[codigo] <= 0) delete cart[codigo];
  updateProductCard(codigo);
  _recalcularEnvio();
  animarCarrito();
  animateCartCount();
  _ocultarErrorCarrito();
}

export function removeFromCart(codigo) {
  delete cart[codigo];
  updateProductCard(codigo);
  _recalcularEnvio();
  animarCarrito();
  animateCartCount();
  _ocultarErrorCarrito();
}

// ── Actualizar tarjeta en el catálogo ─────────────────────────────────────────
export function updateProductCard(codigo) {
  const card = document.querySelector(`[data-codigo="${codigo}"]`);
  if (!card) return;
  const cantidad = cart[codigo] || 0;

  if (cantidad === 0) {
    const ctrl = card.querySelector('.quantity-controls');
    if (ctrl) {
      const btn = document.createElement('button');
      btn.textContent = 'Agregar';
      btn.onclick = (e) => { e.stopPropagation(); addToCart(codigo); };
      ctrl.replaceWith(btn);
    }
  } else {
    const ctrl = card.querySelector('.quantity-controls');
    if (ctrl) {
      ctrl.querySelector('span').textContent = cantidad;
    } else {
      const oldBtn = card.querySelector('button');
      if (oldBtn) oldBtn.replaceWith(_buildControls(codigo, cantidad));
    }
  }
}

function _buildControls(codigo, cantidad) {
  const div = document.createElement('div');
  div.className = 'quantity-controls';

  const menos = document.createElement('button');
  menos.textContent = '-';
  menos.onclick = (e) => { e.stopPropagation(); updateQuantity(codigo, -1); };

  const span = document.createElement('span');
  span.textContent = cantidad;

  const mas = document.createElement('button');
  mas.textContent = '+';
  mas.onclick = (e) => { e.stopPropagation(); updateQuantity(codigo, 1); };

  div.append(menos, span, mas);
  return div;
}

// ── Render del panel lateral del carrito ──────────────────────────────────────
export function updateCart() {
  const ul = document.getElementById('cart-items');
  if (!ul) return;

  ul.innerHTML = '';
  let subtotal = 0;
  let count    = 0;

  for (const codigo in cart) {
    const prod = products.find(p => p.Codigo === codigo);
    if (!prod) continue;
    const cantidad = cart[codigo];
    subtotal += prod.Precio * cantidad;
    count    += cantidad;

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="cart-item">
        <img class="thumb"
          src="${escapeHtml(prod.Imagen)}" alt="${escapeHtml(prod.Nombre)}"
          onerror="this.onerror=null;this.src='/media_static/placeholder.jpg'"
          width="80" height="80" style="object-fit:cover">
        <div>
          <strong>${escapeHtml(prod.Nombre)}</strong>
          <div class="quantity-controls">
            <button data-action="menos" data-cod="${codigo}">-</button>
            <span>${cantidad}</span>
            <button data-action="mas"   data-cod="${codigo}">+</button>
            <button data-action="del"   data-cod="${codigo}" class="remove-btn">❌</button>
          </div>
          <p>$${prod.Precio * cantidad}</p>
        </div>
      </div>`;
    ul.appendChild(li);
  }

  // Delegación de eventos (evita onclick inline con globals)
  ul.onclick = (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, cod } = btn.dataset;
    if (action === 'menos') updateQuantity(cod, -1);
    if (action === 'mas')   updateQuantity(cod,  1);
    if (action === 'del')   removeFromCart(cod);
  };

  setPedidoMinimo(subtotal >= cantidadMinima);

  const envio = costoEnvioActual;
  const total = subtotal + envio;

  // Actualizar contadores del header
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('total');
  if (countEl) countEl.textContent = count;
  if (totalEl) totalEl.textContent = total;

  // Subtotales inline (estructura del HTML real)
  const subtotalDisplay = document.getElementById('subtotal-display');
  const envioDisplay    = document.getElementById('envio-display');
  if (subtotalDisplay) subtotalDisplay.textContent = `$${subtotal}`;
  if (envioDisplay)    envioDisplay.textContent    = envio > 0 ? `$${envio}` : '—';

  // cart-summary (usado por form.js para leer totales)
  const resumen = document.getElementById('cart-summary');
  if (resumen) {
    resumen.innerHTML = `
      <p>Subtotal: $${subtotal}</p>
      <p>Envío: $${envio}</p>
      <p><strong>Total: $${total}</strong></p>`;
  }

  saveCartToSession();
}

// ── Toggle panel carrito ──────────────────────────────────────────────────────
export function toggleCart() {
  const panel    = document.getElementById('cart');
  const botonWpp = document.getElementById('boton-wpp');
  if (!panel) return;
  panel.classList.toggle('visible');
  if (botonWpp) {
    panel.classList.contains('visible') ? Ocultar(botonWpp) : Mostrar(botonWpp);
  }
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
export function consultarWhatsApp() {
  const direccion = document.getElementById('address')?.value?.trim() || '';
  let msg = 'Hola! Vengo de la pagina web.';

  if (Object.keys(cart).length > 0) {
    let subtotal = 0;
    const detalle = [];
    for (const cod in cart) {
      const prod = products.find(p => p.Codigo === cod);
      if (!prod) continue;
      subtotal += prod.Precio * cart[cod];
      detalle.push(`- ${prod.Nombre}: ${cart[cod]} unidades`);
    }
    msg += `\nQuisiera consultar sobre el siguiente pedido:\nSubtotal: $${subtotal}\nDetalle:\n${detalle.join('\n')}`;
    if (direccion) msg += `\nDirección de envío: ${direccion}`;
  }

  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── Privadas ──────────────────────────────────────────────────────────────────
function _recalcularEnvio() {
  const val = document.getElementById('address')?.value?.trim();
  if (val && val.toUpperCase() !== 'A ACORDAR') {
    document.dispatchEvent(new CustomEvent('cart:changed'));
  } else {
    updateCart();
  }
}

function _ocultarErrorCarrito() {
  const div = document.getElementById('carrito-error');
  if (div && Object.keys(cart).length > 0) {
    div.textContent   = '';
    div.style.display = 'none';
  }
}