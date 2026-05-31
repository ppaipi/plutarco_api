// ─── api.js ───────────────────────────────────────────────────────────────────

import {
  setAllProducts, setProducts, setFilteredProducts,
  setConfiguracion, setDiasEntregaConfig, setPreciosEnvioConfig,
  setCantidadMinima, setOrdenCategorias, setCategoriaEmojis,
  setOrdenSubCategorias, setEstadoTienda, setMensajeEstado, setAnuncioUrl,
} from './state.js';

const BASE = 'https://plutarco-api.fly.dev';

function mapProduct(item) {
  return {
    Id:          item.id,
    Codigo:      item.codigo,
    Nombre:      item.nombre,
    Descripcion: item.descripcion,
    Categoria:   item.categoria,
    SubCategoria:item.subcategoria,
    Precio:      item.precio,
    Proveedor:   item.proveedor,
    Orden:       item.orden,
    Imagen:      item.imagen_url,
  };
}

export async function fetchProducts() {
  const res  = await fetch(`${BASE}/products/enabled`);
  const data = await res.json();
  const mapped = data.map(mapProduct);
  setAllProducts(mapped);
  setProducts(mapped);
  setFilteredProducts([...mapped]);
  return mapped;
}

export async function fetchConfig() {
  const res = await fetch(`${BASE}/config/list`);
  const cfg = await res.json();
  setConfiguracion(cfg);
  setDiasEntregaConfig(cfg.dias_entrega     || []);
  setPreciosEnvioConfig(cfg.envio_tarifas   || []);
  setCantidadMinima(cfg.pedido_minimo        || 0);
  const cats = cfg.orden_categorias || [];
  setOrdenCategorias(cats.filter(c => c.name).map(c => c.name));
  setCategoriaEmojis(cats);
  setOrdenSubCategorias(cfg.orden_subcategorias || []);
  setEstadoTienda(cfg.status !== false);
  setMensajeEstado(cfg.mensage_status || '');
  setAnuncioUrl(cfg.anuncio_habilitado ? (cfg.anuncio_imagen_url || null) : null);
  return cfg;
}

export async function postOrder(payload) {
  const res = await fetch(`${BASE}/orders/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}