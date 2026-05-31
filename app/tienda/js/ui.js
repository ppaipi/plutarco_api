// ─── ui.js ───────────────────────────────────────────────────────────────────

import { cart, anuncioUrl, mensajeEstado } from './state.js';
import { addToCart, updateQuantity }        from './cart.js';
import { escapeHtml, Mostrar }              from './utils.js';  // ← import directo, sin await

// ── Modal descripción ─────────────────────────────────────────────────────────
export function crearModalDescripcion(prod) {
  const oldModal = document.getElementById('modal-descripcion');
  if (oldModal) oldModal.remove();

  const modalOverlay = document.createElement('div');
  modalOverlay.id        = 'modal-descripcion';
  modalOverlay.className = 'modal-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content modal-content-anim';

  // Imagen
  const img     = document.createElement('img');
  img.className = 'modal-img';
  img.id        = `modal-img-${prod.Codigo}`;
  img.src       = escapeHtml(prod.Imagen);
  img.alt       = prod.Nombre;
  img.onerror   = function () { this.onerror = null; this.src = '/media_static/placeholder.jpg'; };
  img.onclick   = () => toggleZoom(img.id);

  // Info
  const infoDiv     = document.createElement('div');
  infoDiv.className = 'modal-info';

  const title       = document.createElement('h3');
  title.className   = 'modal-title';
  title.textContent = prod.Nombre;

  const desc       = document.createElement('p');
  desc.className   = 'modal-desc';
  desc.innerHTML   = (prod.Descripcion || 'Sin descripción disponible.').replace(/\n/g, '<br>');

  const price             = document.createElement('div');
  price.className         = 'modal-price';
  price.style.fontWeight  = 'bold';
  price.style.fontSize    = '1.2rem';
  price.style.marginBottom = '1.2rem';
  price.textContent       = `$${prod.Precio}`;

  // Controles cantidad
  const controls = document.createElement('div');

  function renderControls() {
    controls.innerHTML = '';
    const cantidad = cart[prod.Codigo] || 0;

    if (cantidad > 0) {
      controls.className = 'modal-controls quantity-controls';

      const btnMenos       = document.createElement('button');
      btnMenos.textContent = '-';
      btnMenos.onclick     = (e) => { e.stopPropagation(); updateQuantity(prod.Codigo, -1); renderControls(); };

      const spanCantidad       = document.createElement('span');
      spanCantidad.textContent = cantidad;

      const btnMas       = document.createElement('button');
      btnMas.textContent = '+';
      btnMas.onclick     = (e) => { e.stopPropagation(); updateQuantity(prod.Codigo, 1); renderControls(); };

      controls.append(btnMenos, spanCantidad, btnMas);
    } else {
      controls.className = 'modal-controls';

      const btnAgregar       = document.createElement('button');
      btnAgregar.textContent = 'Agregar al carrito';
      btnAgregar.className   = 'agregar-btn';
      btnAgregar.onclick     = (e) => { e.stopPropagation(); addToCart(prod.Codigo); renderControls(); };
      controls.appendChild(btnAgregar);
    }
  }
  renderControls();

  infoDiv.append(title, desc, price, controls);

  const closeBtn     = document.createElement('button');
  closeBtn.className = 'modal-close-btn';
  closeBtn.innerHTML = '✖';
  closeBtn.onclick   = cerrarModalDescripcion;

  modalContent.append(img, infoDiv, closeBtn);
  modalOverlay.appendChild(modalContent);
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) cerrarModalDescripcion(); };
  document.body.appendChild(modalOverlay);

  function escListener(e) {
    if (e.key === 'Escape') { cerrarModalDescripcion(); document.removeEventListener('keydown', escListener); }
  }
  document.addEventListener('keydown', escListener);
}

export function cerrarModalDescripcion() {
  const modal = document.getElementById('modal-descripcion');
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  if (content) {
    content.classList.remove('modal-content-anim');
    content.classList.add('modal-content-anim-close');
    setTimeout(() => modal.remove(), 180);
  } else {
    modal.remove();
  }
}

// ── Zoom de imagen ────────────────────────────────────────────────────────────
export function toggleZoom(idImagen) {
  const original = document.getElementById(idImagen);
  if (!original) return;

  const existingClone = document.querySelector('.zoom-clone');
  if (existingClone) { closeZoom(existingClone); return; }

  let overlay = document.querySelector('.zoom-overlay');
  if (!overlay) {
    overlay           = document.createElement('div');
    overlay.className = 'zoom-overlay';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');

  let closeBtn = document.querySelector('.zoom-close-btn');
  if (!closeBtn) {
    closeBtn           = document.createElement('div');
    closeBtn.className = 'zoom-close-btn';
    closeBtn.textContent = '×';
    document.body.appendChild(closeBtn);
  }
  closeBtn.style.display = 'block';

  const clone = original.cloneNode(true);
  clone.classList.add('zoom-clone');
  document.body.appendChild(clone);

  const rect       = original.getBoundingClientRect();
  clone.style.cssText = `
    transition: none; position: fixed;
    top: ${rect.top}px; left: ${rect.left}px;
    width: ${rect.width}px; height: ${rect.height}px; margin: 0;`;
  clone.getBoundingClientRect(); // forzar reflow

  const vw          = window.innerWidth;
  const vh          = window.innerHeight;
  const maxW        = vw <= 600 ? 0.9 : 0.75;
  const maxH        = vw <= 600 ? 0.9 : 0.75;
  const aspect      = rect.width / rect.height;
  let fw            = vw * maxW;
  let fh            = fw / aspect;
  if (fh > vh * maxH) { fh = vh * maxH; fw = fh * aspect; }

  setTimeout(() => {
    clone.style.transition = 'top .3s ease, left .3s ease, width .3s ease, height .3s ease';
    clone.style.top        = `${(vh - fh) / 2}px`;
    clone.style.left       = `${(vw - fw) / 2}px`;
    clone.style.width      = `${fw}px`;
    clone.style.height     = `${fh}px`;
  }, 20);

  function closeZoom(cloneImg) {
    cloneImg.style.top    = `${rect.top}px`;
    cloneImg.style.left   = `${rect.left}px`;
    cloneImg.style.width  = `${rect.width}px`;
    cloneImg.style.height = `${rect.height}px`;
    overlay.classList.remove('open');
    closeBtn.style.display = 'none';
    cloneImg.addEventListener('transitionend', () => cloneImg.remove(), { once: true });
  }

  function escListener(e) {
    if (e.key === 'Escape') { closeZoom(clone); document.removeEventListener('keydown', escListener); }
  }
  document.addEventListener('keydown', escListener);
  overlay.onclick  = (e) => { if (e.target === overlay) closeZoom(clone); };
  clone.onclick    = () => closeZoom(clone);
  closeBtn.onclick = () => closeZoom(clone);
}

// ── Anuncio ───────────────────────────────────────────────────────────────────
export function mostrarAnuncio() {
  if (!anuncioUrl) return;

  const overlay     = document.createElement('div');
  overlay.id        = 'anuncio-overlay';
  overlay.className = 'anuncio-overlay';

  const box     = document.createElement('div');
  box.className = 'anuncio-box';

  const img     = document.createElement('img');
  img.src       = anuncioUrl;
  img.alt       = 'Anuncio';
  img.className = 'anuncio-img';

  const btn     = document.createElement('button');
  btn.innerHTML = '✕';
  btn.className = 'anuncio-close';

  const cerrar = () => overlay.remove();
  btn.onclick     = cerrar;
  overlay.onclick = (e) => { if (e.target === overlay) cerrar(); };
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); }
  });

  box.append(img, btn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Tienda cerrada ────────────────────────────────────────────────────────────
export function mostrarMensajeEstado() {
  // Mostrar está importado arriba — sin await
  const divEstado = document.getElementById('status-div');
  Mostrar(divEstado);
  const estadoTitle   = document.getElementById('status-title');
  const estadoMensaje = document.getElementById('status-msg');
  if (estadoTitle)   estadoTitle.textContent = 'Tienda pausada';
  if (estadoMensaje) estadoMensaje.innerHTML = mensajeEstado;
}

// ── Dropdown de categorías ────────────────────────────────────────────────────
export function initDropdown() {
  const dropdownBtn     = document.querySelector('.dropdown-btn');
  const dropdownContent = document.querySelector('.dropdown-content');
  const arrow           = document.querySelector('.dropdown-btn .arrow');
  if (!dropdownBtn || !dropdownContent) return;

  const isTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function positionDropdown() {
    const rect = dropdownBtn.getBoundingClientRect();
    dropdownContent.style.top  = `${rect.bottom}px`;
    dropdownContent.style.left = `${rect.left}px`;
    if (rect.left + 360 > window.innerWidth) {
      dropdownContent.style.left = `${window.innerWidth - 370}px`;
    }
  }

  if (isTouch()) {
    dropdownBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const open = dropdownContent.classList.contains('show');
      if (!open) { positionDropdown(); dropdownContent.classList.add('show'); arrow?.classList.add('rotate'); }
      else        { dropdownContent.classList.remove('show'); arrow?.classList.remove('rotate'); }
    });
    document.addEventListener('click', (e) => {
      if (!dropdownBtn.contains(e.target) && !dropdownContent.contains(e.target)) {
        dropdownContent.classList.remove('show'); arrow?.classList.remove('rotate');
      }
    });
  } else {
    dropdownBtn.closest('.dropdown')?.addEventListener('mouseenter', positionDropdown);
  }

  window.addEventListener('scroll', () => { if (dropdownContent.classList.contains('show')) positionDropdown(); });
  window.addEventListener('resize', () => { if (dropdownContent.classList.contains('show')) positionDropdown(); });
}