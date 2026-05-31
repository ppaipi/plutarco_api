// ─── main-tienda.js ───────────────────────────────────────────────────────────
// Entry point de tienda.html (catálogo completo).
// Importa solo lo que esta página necesita.

import { fetchConfig, fetchProducts }                     from './api.js';
import { estadoTienda, anuncioUrl }                       from './state.js';
import { loadCartFromSession }                            from './state.js';
import { updateCart, toggleCart, consultarWhatsApp }     from './cart.js';
import { initAutocomplete, actualizarEnvio }              from './shipping.js';
import {
  renderCategoryMenu, renderProductsByCategory,
  renderCategoryCards, renderQuickCats,
  filterCategory, searchProduct, getQueryParam,
  highlightSelected, aplicarFiltrosDesdeURL
} from './products.js';
import { mostrarAnuncio, mostrarMensajeEstado, initDropdown } from './ui.js';
import { cargarDiasEntrega, initFormValidation, enviarPedido } from './form.js';
import { filteredProducts, setCurrentFilter, setFilteredProducts, setIndiceCategoria, products } from './state.js';
import { Mostrar }                                        from './utils.js';

// ── Exponer funciones globales que usa el HTML con onclick ────────────────────
// (Alternativa: migrar todos los onclick a addEventListener en initEventListeners)
window.toggleCart         = toggleCart;
window.consultarWhatsApp  = consultarWhatsApp;
window.filterCategory     = filterCategory;
window.enviarPedido       = enviarPedido;
window.searchProduct = searchProduct;

// ── Escuchar cambios en el carrito para recalcular envío ─────────────────────
document.addEventListener('cart:changed', actualizarEnvio);

// ── Escuchar cambio de dirección ──────────────────────────────────────────────
document.addEventListener('address:changed', (e) => {
  // shipping.js ya llama a actualizarEnvioConCache; esto es por si otra parte necesita reaccionar
});

// ── Init ──────────────────────────────────────────────────────────────────────
window.onload = async () => {
  await fetchConfig();

  if (estadoTienda) {
    await fetchProducts();

    loadCartFromSession();

    renderCategoryMenu();
    renderCategoryCards();
    renderQuickCats();
    updateCart();
    cargarDiasEntrega();
    initAutocomplete();
    initFormValidation();
    initDropdown();

    aplicarFiltrosDesdeURL();


    // Buscador
    document.getElementById('search-input')?.addEventListener('input', searchProduct);

    // Click en logo/header → volver al inicio
    document.getElementById('click_header')?.addEventListener('click', () => {
      setIndiceCategoria('');
      setCurrentFilter('Todas');

      setFilteredProducts([...products]);

      renderProductsByCategory(products);
    });

    // Mostrar botón de contacto
    Mostrar(document.getElementById('btn-contacto-tienda'));

    // Scroll suave al header al cargar
    document.querySelector('header')?.scrollIntoView({ behavior: 'smooth' });
  } else {
    mostrarMensajeEstado();
  }

  if (anuncioUrl) mostrarAnuncio();
};
