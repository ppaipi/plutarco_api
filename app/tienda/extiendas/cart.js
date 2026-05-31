let cart = {};
const CART_STORAGE_KEY = 'plutarco_cart';
let lastAddToCart = Date.now();
let costoEnvioActual = 0;
let timeoutEnvio;
let calculandoEnvio = false;
let cacheEnvios = {};

function saveCartToSession() {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.warn('No se pudo guardar el carrito en sessionStorage:', err);
  }
}
function loadCartFromSession() {
  try {
    const stored = sessionStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        cart = parsed;
      }
    }
  } catch (err) {
    console.warn('No se pudo cargar el carrito desde sessionStorage:', err);
    cart = {};
  }
}

window.saveCartToSession = saveCartToSession;
window.loadCartFromSession = loadCartFromSession;

