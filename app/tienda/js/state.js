// ─── state.js ────────────────────────────────────────────────────────────────
// Única fuente de verdad. Todos los módulos importan desde acá.
// Los "setters" existen porque ES Modules exportan bindings de solo lectura
// para primitivos — para mutar hay que llamar al setter.

export let products          = [];
export let allProducts       = [];
export let filteredProducts  = [];
export let cart              = {};

export let currentFilter     = 'Todas';
export let currentSearch     = '';
export let indiceCategoria   = '';

export let configuracion     = {};
export let diasEntregaConfig = [];
export let preciosEnvioConfig= [];
export let cantidadMinima    = 0;
export let pedidoMinimo      = false;
export let estadoTienda      = true;
export let mensajeEstado     = '';
export let anuncioUrl        = null;

export let costoEnvioActual  = 0;
export let calculandoEnvio   = false;
export let cacheEnvios       = {};
export let lastAddToCart     = 0;

export let ordenCategorias   = [];
export let CATEGORIA_EMOJIS  = [];
export let ordenSubCategorias= [];

export const LOCAL_ADDRESS   = 'Ibera 3852, Coghlan, CABA, Argentina.';
export const CART_KEY        = 'plutarco_cart';
export const WA_NUMBER       = '5491150168920';

// ── Setters ───────────────────────────────────────────────────────────────────
export function setProducts(v)            { products          = v; }
export function setAllProducts(v)         { allProducts        = v; }
export function setFilteredProducts(v)    { filteredProducts   = v; }
export function setCart(v)               { cart               = v; }
export function setCurrentFilter(v)      { currentFilter      = v; }
export function setCurrentSearch(v)      { currentSearch      = v; }
export function setIndiceCategoria(v)    { indiceCategoria    = v; }
export function setConfiguracion(v)      { configuracion      = v; }
export function setDiasEntregaConfig(v)  { diasEntregaConfig  = v; }
export function setPreciosEnvioConfig(v) { preciosEnvioConfig = v; }
export function setCantidadMinima(v)     { cantidadMinima     = v; }
export function setPedidoMinimo(v)       { pedidoMinimo       = v; }
export function setEstadoTienda(v)       { estadoTienda       = v; }
export function setMensajeEstado(v)      { mensajeEstado      = v; }
export function setAnuncioUrl(v)         { anuncioUrl         = v; }
export function setCostoEnvioActual(v)   { costoEnvioActual   = v; }
export function setCalculandoEnvio(v)    { calculandoEnvio    = v; }
export function setLastAddToCart(v)      { lastAddToCart      = v; }
export function setOrdenCategorias(v)    { ordenCategorias    = v; }
export function setCategoriaEmojis(v)    { CATEGORIA_EMOJIS   = v; }
export function setOrdenSubCategorias(v) { ordenSubCategorias = v; }

// ── Persistencia sessionStorage ───────────────────────────────────────────────
export function saveCartToSession() {
  try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_) {}
}

export function loadCartFromSession() {
  try {
    const saved = sessionStorage.getItem(CART_KEY);
    if (saved) cart = JSON.parse(saved);
  } catch (_) {}
}