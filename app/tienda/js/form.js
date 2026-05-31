// ─── form.js ──────────────────────────────────────────────────────────────────
// Validación de campos, envío del pedido y pantalla de confirmación.

import {
  cart, products, costoEnvioActual,
  diasEntregaConfig, setCart,
} from './state.js';
import { postOrder }                      from './api.js';
import { mostrarMensajeEnvio, getAutocomplete, getDireccionValidaGoogle } from './shipping.js';
import { updateCart }                     from './cart.js';
import { filterCategory }                 from './products.js';
import { capitalize }                     from './utils.js';

// ── Estado del formulario ─────────────────────────────────────────────────────
const validacionCampos = {
  'pickup-day': false, name: false, email: false,
  phone: false, address: false, comment: false, carrito: false,
};
const camposTocados = {
  'pickup-day': false, name: false, email: false,
  phone: false, address: false, comment: false,
};
let intentoEnviar = false;

// ── Cargar días de entrega ────────────────────────────────────────────────────
export function cargarDiasEntrega() {
  const select = document.getElementById('pickup-day');
  if (!select) return;

  const diasValidos = diasEntregaConfig.length
    ? diasEntregaConfig
    : [{ weekday: 1, cutoff: '' }, { weekday: 3, cutoff: '' }];

  const ahora       = new Date();
  let fechaIterada  = new Date();
  const opciones    = [];

  while (opciones.length < 3) {
    const diaSemana = fechaIterada.getDay();
    const diaConfig = diasValidos.find(d => d.weekday === diaSemana);

    if (diaConfig) {
      let incluir = true;
      if (fechaIterada.toDateString() === ahora.toDateString() && diaConfig.cutoff?.trim()) {
        const [h, m] = diaConfig.cutoff.split(':').map(Number);
        const cutoff = new Date(ahora);
        cutoff.setHours(h, m, 0, 0);
        if (ahora > cutoff) incluir = false;
      }

      if (incluir) {
        const diaTexto   = fechaIterada.toLocaleDateString('es-AR', { weekday: 'long' });
        const fechaTexto = fechaIterada.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        const horaTexto  = diaConfig.cutoff ? `${diaConfig.cutoff.split(':')[0]} hs aprox` : 'horario a confirmar';
        opciones.push({
          value: new Date(fechaIterada).toISOString().split('T')[0],
          texto: `${capitalize(diaTexto)} ${fechaTexto} · ${horaTexto}`,
        });
      }
    }

    fechaIterada.setDate(fechaIterada.getDate() + 1);
  }

  select.innerHTML = '<option value="" disabled selected>Seleccionar una fecha</option>';
  opciones.forEach(opt => {
    const option       = document.createElement('option');
    option.value       = opt.value;
    option.textContent = opt.texto;
    select.appendChild(option);
  });
}

// ── Validación en tiempo real ─────────────────────────────────────────────────
const CAMPOS_CONFIG = [
  { id: 'pickup-day', validar: v => !!v,                                    mensaje: 'Seleccione un día de retiro.' },
  { id: 'name',       validar: v => !!v && v.includes(' '),                 mensaje: 'Ingrese su nombre completo.' },
  { id: 'email',      validar: v => !!v && v.includes('@') && v.includes('.'), mensaje: 'Ingrese un mail válido.' },
  { id: 'phone',      validar: v => !!v && v.length >= 8,                   mensaje: 'Ingrese un teléfono válido.' },
  { id: 'comment',    validar: v => !!v,                                    mensaje: 'Ingrese un comentario.' },
];

export function validarCamposEnTiempoReal() {
  let hayError = false;

  CAMPOS_CONFIG.forEach(campo => {
    const el = document.getElementById(campo.id);
    if (!el) return;
    const valor       = el.value.trim();
    const esValido    = campo.validar(valor);
    const mostrarErr  = (camposTocados[campo.id] || intentoEnviar) && !esValido;

    el.classList.remove('input-error', 'input-success');
    if (!esValido) {
      if (mostrarErr) { el.classList.add('input-error'); hayError = true; }
      validacionCampos[campo.id] = false;
    } else {
      el.classList.add('input-success');
      validacionCampos[campo.id] = true;
    }

    mostrarErrorDebajoDe(el, mostrarErr ? campo.mensaje : '');
  });

  validarDireccionSolo();

  // Carrito vacío
  let carritoErr = document.getElementById('carrito-error');
  if (!carritoErr) {
    carritoErr = document.createElement('div');
    carritoErr.id           = 'carrito-error';
    carritoErr.style.color  = 'red';
    carritoErr.style.margin = '4px 0 0 0';
    (document.getElementById('pedido-form') || document.getElementById('cart'))?.appendChild(carritoErr);
  }
  if (intentoEnviar && Object.keys(cart).length === 0) {
    carritoErr.textContent  = 'Agregue productos al carrito.';
    carritoErr.style.display = 'block';
    hayError = true;
    validacionCampos.carrito = false;
  } else {
    carritoErr.textContent   = '';
    carritoErr.style.display = 'none';
    validacionCampos.carrito  = Object.keys(cart).length > 0;
  }

  const btn = document.getElementById('submit-btn');
  if (btn) btn.disabled = hayError;
  return !hayError;
}

export function validarDireccionSolo() {
  const el = document.getElementById('address');
  if (!el) return;
  const valor = el.value.trim();
  const esValida = getDireccionValidaGoogle() || valor.toUpperCase() === 'A ACORDAR';
  const mostrarErr = (camposTocados.address || intentoEnviar) && !esValida;

  el.classList.remove('input-error', 'input-success');
  if (!esValida) {
    if (mostrarErr) el.classList.add('input-error');
    validacionCampos.address = false;
  } else {
    el.classList.add('input-success');
    validacionCampos.address = true;
  }
  mostrarErrorDebajoDe(el, mostrarErr ? 'Seleccione una dirección válida.' : '');

  const btn = document.getElementById('submit-btn');
  if (btn) btn.disabled = !todosCamposValidados();
}

function todosCamposValidados() {
  return Object.values(validacionCampos).every(v => v === true);
}

function mostrarErrorDebajoDe(el, mensaje) {
  const parent   = el.closest('.inputs') || el.parentNode;
  let errorDiv   = parent.querySelector('.campo-error');
  if (!errorDiv) {
    errorDiv           = document.createElement('div');
    errorDiv.className = 'campo-error';
    parent.appendChild(errorDiv);
  }
  errorDiv.textContent  = mensaje;
  errorDiv.style.display = mensaje ? 'block' : 'none';
}

// ── Inicializar eventos del formulario ────────────────────────────────────────
export function initFormValidation() {
  CAMPOS_CONFIG.map(c => c.id).concat(['address']).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (id === 'address') {
      el.addEventListener('blur',   () => { camposTocados.address = true; validarDireccionSolo(); });
      el.addEventListener('change', () => { camposTocados.address = true; validarDireccionSolo(); });
      el.addEventListener('input',  () => validarDireccionSolo());
    } else {
      el.addEventListener('blur',   () => { camposTocados[id] = true; validarCamposEnTiempoReal(); });
      el.addEventListener('change', () => { camposTocados[id] = true; validarCamposEnTiempoReal(); });
      el.addEventListener('input',  () => validarCamposEnTiempoReal());
    }
  });
}

// ── Enviar pedido ─────────────────────────────────────────────────────────────
export async function enviarPedido() {
  intentoEnviar = true;
  validarCamposEnTiempoReal();
  if (!todosCamposValidados()) return;

  const btn = document.getElementById('submit-btn');
  bloquearBoton(btn);

  let totalProductos = 0;
  const productos = [];

  for (const codigo in cart) {
    const prod    = products.find(p => p.Codigo === codigo);
    const cantidad = cart[codigo];
    totalProductos += prod.Precio * cantidad;
    productos.push({
      nombre:          prod.Nombre,
      codigo:          prod.Codigo,
      cantidad,
      precio_unitario: prod.Precio,
      subtotal:        prod.Precio * cantidad,
    });
  }

  const autocomplete = getAutocomplete();
  let   direccion    = document.getElementById('address').value.trim();
  if (autocomplete?.getPlace?.()?.formatted_address) {
    direccion = autocomplete.getPlace().formatted_address;
  }

  const payload = {
    nombre_completo: document.getElementById('name').value.trim(),
    correo:          document.getElementById('email').value.trim(),
    telefono:        document.getElementById('phone').value.trim(),
    direccion,
    comentario:      document.getElementById('comment').value.trim(),
    dia_entrega:     document.getElementById('pickup-day').value || null,
    envio_cobrado:   Number(costoEnvioActual) || 0,
    confirmado:      false,
    entregado:       false,
    productos,
    subtotal:        totalProductos,
    total:           totalProductos + (Number(costoEnvioActual) || 0),
  };

  try {
    const orderData = await postOrder(payload);

    setCart({});
    mostrarMensajeEnvio('', 'black');
    window.scrollTo(0, 0);
    updateCart();
    filterCategory('Todas');
    mostrarConfirmacionPedido(orderData);
  } catch (err) {
    console.error('Error enviarPedido:', err);
    alert('Error enviando pedido. Intente nuevamente.');
  } finally {
    desbloquearBoton(btn);
    intentoEnviar = false;
  }
}

function bloquearBoton(btn)   { if (btn) { btn.disabled = true;  btn.textContent = 'Enviando...'; } }
function desbloquearBoton(btn){ if (btn) { btn.disabled = false; btn.textContent = 'Finalizar Pedido'; } }

// ── Pantalla de confirmación ──────────────────────────────────────────────────
function mostrarConfirmacionPedido(data) {
  const order    = data.order;
  const prods    = data.productos;

  let productosHtml = '';
  prods.forEach(p => {
    const subtotal = (p.precio_unitario || 0) * (p.cantidad || 0);
    productosHtml += `
      <table class="producto-table">
        <tr>
          <td class="prod-badge"><div>${p.cantidad}</div></td>
          <td class="prod-info">
            <div class="prod-nombre">${p.nombre}</div>
            <div class="prod-precio">${Math.round(p.precio_unitario)} c/u</div>
          </td>
          <td class="prod-subtotal" align="right"><div>$${Math.round(subtotal)}</div></td>
        </tr>
      </table>`;
  });

  let diaEntregaFormateado = 'No especificado';
  if (order.dia_entrega) {
    diaEntregaFormateado = new Date(order.dia_entrega).toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  document.body.innerHTML = `
<div class="confirm-wrap">
  <div class="confirm-header">
    <div class="confirm-header-logo"><img src="/media_static/iconpng.ico" alt="Plutarco"></div>
    <div class="confirm-header-text"><strong>Plutarco Almacén</strong><span>Coghlan · CABA</span></div>
    <div class="confirm-header-badge">Pedido #${order.id}</div>
  </div>
  <div class="confirm-body">
    <div class="confirm-success">
      <div class="confirm-success-icon">✓</div>
      <h2>¡Tu pedido fue recibido!</h2>
      <p>Te enviamos una copia de este resumen a tu correo electrónico.<br>
         Confirmamos en cuanto recibamos el comprobante de pago.</p>
    </div>
    <hr class="section-divider">
    <div class="confirm-section-title">Datos de entrega</div>
    <div class="confirm-info-grid">
      <div class="confirm-info-item"><div class="label">Nombre</div><div class="value">${order.nombre_completo}</div></div>
      <div class="confirm-info-item"><div class="label">Teléfono</div><div class="value">${order.telefono}</div></div>
      <div class="confirm-info-item"><div class="label">Día de entrega</div><div class="value">${diaEntregaFormateado}</div></div>
      <div class="confirm-info-item"><div class="label">Email</div><div class="value">${order.correo}</div></div>
      <div class="confirm-info-item full"><div class="label">Dirección</div><div class="value">${order.direccion}</div></div>
      <div class="confirm-info-item full"><div class="label">Comentario</div><div class="value">${order.comentario}</div></div>
    </div>
    <hr class="section-divider">
    <div class="confirm-section-title">Productos</div>
    <div class="confirm-products">${productosHtml}</div>
    <hr class="section-divider">
    <div class="confirm-totales">
      <div class="total-row"><span>Subtotal</span><span>$${Math.round(order.subtotal)}</span></div>
      <div class="total-row"><span>Envío</span><span>$${Math.round(order.envio_cobrado)}</span></div>
      <div class="total-main"><span>Total</span><span>$${Math.round(order.total)}</span></div>
    </div>
    <hr class="section-divider">
    <div class="confirm-pago">
      <h4>💸 Información de pago</h4>
      <p>Transferí <strong>$${Math.round(order.total)}</strong> al alias <strong>plutarco.almacen</strong></p>
      <p>Cuenta a nombre de <strong>Darío Chapur</strong>.</p>
      <p>Envianos el comprobante por
        <a href="https://wa.me/5491150168920?text=Hola Plutarco Almacén! Realicé el pedido #${order.id} de $${Math.round(order.total)} a nombre de ${order.nombre_completo}" target="_blank">
          WhatsApp al 11 5016-8920
        </a> o respondé el email de confirmación.</p>
    </div>
    <div class="confirm-stock">
      <p>⚠️ Si algún producto no tiene stock, te avisamos y hacemos la devolución del monto correspondiente.</p>
    </div>
  </div>
  <div class="confirm-footer">
    <p>¿Consultas? Escribinos por WhatsApp o respondé el email de confirmación.</p>
    <button class="btn-volver" onclick="location.reload()">Volver a la tienda</button>
    <a href="https://wa.me/5491150168920?text=Hola Plutarco Almacén! Tengo una consulta sobre mi pedido #${order.id} a nombre de ${order.nombre_completo}" target="_blank">
      <button class="btn-wsp">Consultar por WhatsApp</button>
    </a>
  </div>
</div>`;

  document.body.style.backgroundColor = '#f4f0e8';
}
