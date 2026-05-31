// ─── shipping.js ─────────────────────────────────────────────────────────────
// Cálculo de costo de envío con Google Maps Distance Matrix.

import {
  cart, products, preciosEnvioConfig, cacheEnvios,
  costoEnvioActual, calculandoEnvio,
  setCostoEnvioActual, setCalculandoEnvio,
  LOCAL_ADDRESS,
} from './state.js';
import { updateCart } from './cart.js';

let autocomplete = null;
let direccionValidaGoogle = false;

export function getDireccionValidaGoogle()       { return direccionValidaGoogle; }
export function setDireccionValidaGoogle(val)    { direccionValidaGoogle = val; }
export function getAutocomplete()                { return autocomplete; }

// ── Google Places Autocomplete ────────────────────────────────────────────────
export function initAutocomplete() {
  const input  = document.getElementById('address');
  if (!input) return;

  const bounds = new google.maps.LatLngBounds(
    { lat: -34.705, lng: -58.531 },
    { lat: -34.515, lng: -58.335 },
  );

  autocomplete = new google.maps.places.Autocomplete(input, {
    fields:                ['formatted_address', 'geometry'],
    componentRestrictions: { country: 'ar' },
  });
  autocomplete.setBounds(bounds);
  autocomplete.setOptions({ strictBounds: false });

  input.addEventListener('input', () => cargandoEnvio(true));

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (place?.formatted_address && place?.geometry) {
      direccionValidaGoogle = true;
      document.dispatchEvent(new CustomEvent('address:changed', {
        detail: { address: place.formatted_address },
      }));
      actualizarEnvioConCache(place.formatted_address);
    } else {
      direccionValidaGoogle = false;
    }
  });
}

// ── Indicador de carga ────────────────────────────────────────────────────────
export function cargandoEnvio(bool) {
  if (bool === calculandoEnvio) return;
  setCalculandoEnvio(bool);
  if (bool) mostrarMensajeEnvio('', 'black');
}

// ── Mostrar mensaje de envío ──────────────────────────────────────────────────
export function mostrarMensajeEnvio(texto, color) {
  const el = document.getElementById('envio-msg');
  if (!el) return;
  if (calculandoEnvio) {
    el.innerHTML   = '<span class="loading-spinner"></span> Calculando envío...';
    el.style.color = '#666';
  } else {
    el.innerHTML   = texto;
    el.style.color = color;
  }
}

// ── Calcular costo con cache ──────────────────────────────────────────────────
export function actualizarEnvioConCache(destino) {
  const key = destino.toLowerCase().trim();
  if (cacheEnvios[key]) {
    const { costo, msg, color } = cacheEnvios[key];
    setCostoEnvioActual(costo);
    mostrarMensajeEnvio(msg, color);
    updateCart();
    return;
  }

  let subtotal = 0;
  for (const codigo in cart) {
    const prod = products.find(p => p.Codigo === codigo);
    if (prod) subtotal += prod.Precio * (cart[codigo] || 0);
  }

  calcularCostoEnvio(destino, subtotal, (costo, mensaje, color) => {
    setCostoEnvioActual(costo);
    mostrarMensajeEnvio(mensaje, color);
    updateCart();
  });
}

// ── Recalcular desde el input actual ─────────────────────────────────────────
export function actualizarEnvio() {
  const input   = document.getElementById('address');
  const place   = autocomplete?.getPlace();
  const destino = place?.formatted_address || input?.value || '';

  let subtotal = 0;
  for (const codigo in cart) {
    const prod = products.find(p => p.Codigo === codigo);
    if (prod) subtotal += prod.Precio * (cart[codigo] || 0);
  }

  calcularCostoEnvio(destino, subtotal, (costo, mensaje, color) => {
    setCostoEnvioActual(costo);
    mostrarMensajeEnvio(mensaje, color);
    updateCart();
  });
}

// ── Core: Distance Matrix ─────────────────────────────────────────────────────
export function calcularCostoEnvio(destino, subtotal, callback) {
  if (!destino || destino.trim().toUpperCase() === 'A ACORDAR') {
    callback(0, 'Dirección A ACORDAR. El costo de envío se definirá al confirmar el pedido.', 'orange');
    return;
  }

  const key = destino.toLowerCase().trim();
  if (cacheEnvios[key]) {
    const { costo, msg, color } = cacheEnvios[key];
    callback(costo, msg, color);
    return;
  }

  cargandoEnvio(true);

  const service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix(
    { origins: [LOCAL_ADDRESS], destinations: [destino], travelMode: 'DRIVING' },
    (response, status) => {
      cargandoEnvio(false);

      if (status !== 'OK' || !response.rows?.[0]?.elements?.[0]) {
        callback(0, 'Error al calcular distancia.', 'red');
        return;
      }

      const element = response.rows[0].elements[0];
      if (element.status !== 'OK') {
        callback(0, 'No se puede entregar a esa dirección.', 'red');
        return;
      }

      const km            = element.distance.value / 1000;
      const kmRedondeado  = Math.ceil(km * 10) / 10;
      const rangos        = [...preciosEnvioConfig].sort((a, b) => a.km - b.km);
      const rango         = rangos.find(r => kmRedondeado <= r.km);

      if (!rango) {
        callback(
          0,
          `Fuera del area de entrega (${kmRedondeado} km) <a href="https://wa.me/5491150168920?text=Hola! Vengo de la página web. \nQuiero cotizar un envio de ${kmRedondeado} km a la dirección: ${destino}" target="_blank">Escribinos y acordamos un precio!</a>`,
          'red',
        );
        return;
      }

      const costo = rango.price;
      const msg   = costo === 0
        ? `Felicidades! Tenés envío gratis!! (${kmRedondeado} km)`
        : `Envío ${kmRedondeado} km — $${costo}`;

      cacheEnvios[key] = { costo, msg, color: 'green' };
      callback(costo, msg, 'green');
    },
  );
}
