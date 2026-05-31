// ─── main-producto.js ─────────────────────────────────────────────────────────
// Entry point de producto.html — vista detalle de un único producto.
//
// Espera un parámetro en la URL: ?codigo=XXXX
// Ejemplo: /producto.html?codigo=PAN001
//
// Reutiliza el carrito, el modal y el envío sin tocar los otros módulos.

import { fetchConfig, fetchProducts }                    from './api.js';
import { estadoTienda, anuncioUrl, products }            from './state.js';
import { loadCartFromSession }                           from './state.js';
import { updateCart, toggleCart, consultarWhatsApp, addToCart, updateQuantity } from './cart.js';
import { initAutocomplete }                              from './shipping.js';
import { crearModalDescripcion, mostrarAnuncio,
         mostrarMensajeEstado, initDropdown }            from './ui.js';
import { cargarDiasEntrega, initFormValidation,
         enviarPedido }                                  from './form.js';
import { escapeHtml }                                    from './utils.js';
import { cart }                                          from './state.js';

// ── Exponer globales para el HTML ─────────────────────────────────────────────
window.toggleCart        = toggleCart;
window.consultarWhatsApp = consultarWhatsApp;
window.enviarPedido      = enviarPedido;

// ── Renderizar un producto en la página ───────────────────────────────────────
function renderProductoDetalle(prod) {
  const container = document.getElementById('producto-detalle');
  if (!container) return;

  container.innerHTML = `
    <div class="producto-detalle-wrap">
      <div class="producto-detalle-imagen">
        <img
          id="prod-img-${prod.Codigo}"
          src="${escapeHtml(prod.Imagen)}"
          alt="${prod.Nombre}"
          onerror="this.src='/media_static/placeholder.jpg'"
          style="width:100%;border-radius:12px;cursor:zoom-in;">
      </div>
      <div class="producto-detalle-info">
        <span class="prod-categoria">${prod.Categoria || ''}</span>
        <h1>${prod.Nombre}</h1>
        <p class="prod-precio-grande">$${prod.Precio}</p>
        <p class="prod-descripcion">${(prod.Descripcion || 'Sin descripción disponible.').replace(/\n/g, '<br>')}</p>
        <div id="detalle-controles"></div>
      </div>
    </div>`;

  // Zoom al click en imagen
  document.getElementById(`prod-img-${prod.Codigo}`)?.addEventListener('click', () => {
    import('./ui.js').then(({ toggleZoom }) => toggleZoom(`prod-img-${prod.Codigo}`));
  });

  renderDetalleControles(prod);
}

function renderDetalleControles(prod) {
  const container = document.getElementById('detalle-controles');
  if (!container) return;
  container.innerHTML = '';

  const cantidad = cart[prod.Codigo] || 0;

  if (cantidad > 0) {
    const div = document.createElement('div');
    div.className = 'quantity-controls quantity-controls-large';

    const btnMenos = document.createElement('button');
    btnMenos.textContent = '-';
    btnMenos.onclick = () => { updateQuantity(prod.Codigo, -1); renderDetalleControles(prod); };

    const span = document.createElement('span');
    span.textContent = cantidad;

    const btnMas = document.createElement('button');
    btnMas.textContent = '+';
    btnMas.onclick = () => { updateQuantity(prod.Codigo, 1); renderDetalleControles(prod); };

    div.appendChild(btnMenos);
    div.appendChild(span);
    div.appendChild(btnMas);
    container.appendChild(div);
  } else {
    const btn = document.createElement('button');
    btn.className   = 'btn-agregar-grande';
    btn.textContent = 'Agregar al carrito';
    btn.onclick     = () => { addToCart(prod.Codigo); renderDetalleControles(prod); };
    container.appendChild(btn);
  }
}

// ── Obtener código del producto desde la URL ──────────────────────────────────
function getCodigoFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('codigo') || params.get('id') || null;
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.onload = async () => {
  await fetchConfig();

  if (!estadoTienda) {
    mostrarMensajeEstado();
    return;
  }

  // Cargamos todos los productos (necesitamos el catálogo para el carrito y sugerencias)
  await fetchProducts();

  loadCartFromSession();
  updateCart();
  cargarDiasEntrega();
  initAutocomplete();
  initFormValidation();
  initDropdown();

  if (anuncioUrl) mostrarAnuncio();

  // Encontrar el producto de esta página
  const codigo = getCodigoFromURL();
  if (!codigo) {
    document.getElementById('producto-detalle').innerHTML =
      '<p>Producto no encontrado. <a href="/">Volver a la tienda</a></p>';
    return;
  }

  const prod = products.find(p => p.Codigo === codigo);
  if (!prod) {
    document.getElementById('producto-detalle').innerHTML =
      `<p>El producto <strong>${codigo}</strong> no existe o no está disponible. <a href="/">Volver a la tienda</a></p>`;
    return;
  }

  // Render del producto
  renderProductoDetalle(prod);

  // SEO básico: título y meta
  document.title = `${prod.Nombre} — Plutarco Almacén`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', prod.Descripcion || prod.Nombre);
};
