from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from app.models import Product
from app.database import get_session
from sqlmodel import select
import json

router = APIRouter()


def get_product_detail_html(product: Product) -> str:
    imagen       = product.imagen_url or "/media_static/placeholder.jpg"
    descripcion  = (product.descripcion or "Sin descripción disponible.").replace('\n', '<br>')
    categoria    = product.categoria    or ""
    subcategoria = product.subcategoria or ""
    precio_fmt   = f"{product.precio:,.0f}".replace(",", ".")

    schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.nombre,
        "description": (product.descripcion or "")[:200],
        "image": imagen,
        "brand": {"@type": "Brand", "name": "Plutarco Almacén"},
        "offers": {
            "@type": "Offer",
            "url": f"https://plutarcoalmacen.com.ar/{product.id}",
            "priceCurrency": "ARS",
            "price": str(product.precio),
            "availability": "https://schema.org/InStock"
        }
    }

    subcategoria_badge = f'<span class="pd-tag">📂 {subcategoria}</span>' if subcategoria else ''
    breadcrumb_sub = (
        f'<span>›</span><a href="/?cat={categoria}">{subcategoria}</a>'
        if subcategoria else ''
    )
    wsp_msg = f"Hola! Quiero consultar sobre: {product.nombre} (${precio_fmt})"

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{product.nombre} | Plutarco Almacén</title>
  <link rel="icon" type="image/jpeg" href="/media_static/icon.ico">
  <meta name="description" content="{(product.descripcion or '')[:160]}">
  <meta property="og:title" content="{product.nombre} | Plutarco Almacén">
  <meta property="og:description" content="{(product.descripcion or '')[:160]}">
  <meta property="og:image" content="{imagen}">
  <meta property="og:url" content="https://plutarcoalmacen.com.ar/{product.id}">
  <meta property="og:type" content="product">
  <link rel="canonical" href="https://plutarcoalmacen.com.ar/{product.id}">
  <script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/tienda/static/styles.css">
  <link rel="stylesheet" href="/tienda/static/pd-addon.css">
</head>
<body>

<header>
  <div class="header-inner">
    <a href="/" class="header-logo">
      <img src="/media_static/iconpng.ico" alt="Logo Plutarco">
      <div class="header-logo-text">
        <strong>Plutarco Almacén</strong>
        <span>Coghlan · CABA</span>
      </div>
    </a>
    <div class="header-search">
      <span class="header-search-icon">🔍</span>
      <input type="text" id="search-input-det"
        placeholder="Buscar otro producto..."
        onkeydown="if(event.key==='Enter') irABuscar(this.value);"
        oninput="irABuscarDebounce(this.value)">
    </div>
    <button class="header-cart-btn" id="cart-icon" onclick="toggleCart()">
      🛒 <span id="cart-count">0</span>
    </button>
  </div>
  <div class="pd-subnav">
    <div class="pd-subnav-inner">
      <a onclick="volverATienda()" mouse-pointer class="pd-back-btn" >← Volver a la tienda</a>
      <div class="pd-breadcrumb">
        <a href="/">Inicio</a>
        <span>›</span>
        <a href="/?cat={categoria}">{categoria}</a>
        {breadcrumb_sub}
        <span>›</span>
        <span>{product.nombre}</span>
      </div>
    </div>
  </div>
</header>


<div class="pd-page">

  <div class="pd-main">

    <div class="pd-img-panel" onclick="pdOpenLightbox('{imagen}')">
      <img src="{imagen}" alt="{product.nombre}" class="pd-main-img"
        onerror="this.src='/media_static/placeholder.jpg'">
      <div class="pd-img-badge">🔍 Ampliar</div>
    </div>

    <div class="pd-detail-panel">

      <div class="pd-tags">
        <span class="pd-tag">🗂 {categoria}</span>
        {subcategoria_badge}
        <span class="pd-tag pd-tag-green">✅ En stock</span>
      </div>

      <h1 class="pd-title">{product.nombre}</h1>

      <div class="pd-price-block">
        <span class="pd-price">${precio_fmt}</span>
        <span class="pd-price-note">por unidad · IVA incluido</span>
      </div>

      <div class="pd-payment-strip">
        <span>💳</span>
        <span>Pagá con transferencia bancaria — 100% seguro</span>
        <span class="pd-payment-arrow">›</span>
      </div>

      <div class="pd-qty-block">
        <span class="pd-qty-label">Cantidad</span>
        <div class="pd-qty-ctrl">
          <button class="pd-qty-btn" onclick="changeQty(-1)">−</button>
          <span class="pd-qty-num" id="qty-display">1</span>
          <button class="pd-qty-btn" onclick="changeQty(1)">+</button>
        </div>
      </div>

      <button class="pd-btn-add" id="btn-agregar" onclick="agregarAlCarrito()">
        🛒 Agregar al carrito
      </button>

      <a class="pd-btn-wsp" href="https://wa.me/5491150168920?text={wsp_msg}" target="_blank">
        💬 Consultar por WhatsApp
      </a>

      <div class="pd-guarantees">
        <div class="pd-guarantee-item">
          <span class="g-icon">🔒</span>
          <div class="g-text">
            <span class="g-title">Compra protegida</span>
            <span class="g-desc">Transferencia verificada. Tus datos, seguros.</span>
          </div>
        </div>
        <div class="pd-guarantee-item">
          <span class="g-icon">🚚</span>
          <div class="g-text">
            <span class="g-title">Envío a domicilio</span>
            <span class="g-desc">Lunes, Miércoles y Viernes · CABA y GBA.</span>
          </div>
        </div>
        <div class="pd-guarantee-item">
          <span class="g-icon">🌿</span>
          <div class="g-text">
            <span class="g-title">Natural y orgánico</span>
            <span class="g-desc">Sin aditivos ni conservantes.</span>
          </div>
        </div>
        <div class="pd-guarantee-item">
          <span class="g-icon">↩️</span>
          <div class="g-text">
            <span class="g-title">Sin stock, sin cargo</span>
            <span class="g-desc">Devolvemos el importe si falta algo.</span>
          </div>
        </div>
      </div>

    </div>
  </div>


  <div class="pd-card-v2">
    <div class="pd-card-header">
      <span class="pd-card-header-icon">📋</span>
      <h2>Descripción del producto</h2>
    </div>
    <div class="pd-desc-body">{descripcion}</div>
  </div>


  <div class="pd-card-v2">
    <div class="pd-card-header">
      <span class="pd-card-header-icon">✨</span>
      <h2>Por qué elegir Plutarco</h2>
    </div>
    <div class="pd-features-grid">
      <div class="pd-feature">
        <span class="pd-feature-icon">🌾</span>
        <strong>Harinas integrales orgánicas</strong>
        <span>Sin harinas blancas, sin aditivos, sin conservantes.</span>
      </div>
      <div class="pd-feature">
        <span class="pd-feature-icon">🏡</span>
        <strong>Hecho en Coghlan</strong>
        <span>Elaborado artesanalmente en nuestro local del barrio.</span>
      </div>
      <div class="pd-feature">
        <span class="pd-feature-icon">📦</span>
        <strong>Fraccionado a tu medida</strong>
        <span>Podés agregar más unidades según lo que necesitás.</span>
      </div>
      <div class="pd-feature">
        <span class="pd-feature-icon">🤝</span>
        <strong>Soporte directo</strong>
        <span>Respondemos por WhatsApp. Sin robots, sin esperas.</span>
      </div>
    </div>
  </div>


  <div class="pd-card-v2">
    <div class="pd-card-header">
      <span class="pd-card-header-icon">🚚</span>
      <h2>Entrega y formas de pago</h2>
    </div>
    <div class="pd-delivery-grid">
      <div class="pd-delivery-item">
        <span class="pd-delivery-icon">📅</span>
        <div class="d-text">
          <strong>Días de entrega</strong>
          <span>Lunes, Miércoles y Viernes. Elegís el día al confirmar.</span>
        </div>
      </div>
      <div class="pd-delivery-item">
        <span class="pd-delivery-icon">📍</span>
        <div class="d-text">
          <strong>Zona de cobertura</strong>
          <span>CABA y GBA. El costo se calcula según tu dirección.</span>
        </div>
      </div>
      <div class="pd-delivery-item">
        <span class="pd-delivery-icon">💳</span>
        <div class="d-text">
          <strong>Transferencia bancaria</strong>
          <span>Al finalizar la compra te proporcionamos los datos de la cuenta.</span>
        </div>
      </div>
      <div class="pd-delivery-item">
        <span class="pd-delivery-icon">↩️</span>
        <div class="d-text">
          <strong>Sin stock, sin cargo</strong>
          <span>Te avisamos y devolvemos el monto si falta algo.</span>
        </div>
      </div>
    </div>
  </div>


  <div class="pd-cta-block">
    <div class="pd-cta-emoji">🛒</div>
    <div class="pd-cta-body">
      <h3>¿Querés armar tu pedido completo?</h3>
      <p>Panadería integral, orgánicos, almacén natural y mucho más desde un solo lugar.</p>
    </div>
    <a href="/" class="pd-cta-link">Ver toda la tienda →</a>
  </div>

</div>


<section class="quienes-somos">
  <div class="qs-inner">
    <div class="qs-text">
      <h2>Hola, somos Plutarco 🌿</h2>
      <p>Somos un almacén de barrio en Coghlan con una panadería integral artesanal.
         Hacemos el pan nosotros mismos, con harinas orgánicas, sin harinas blancas,
         sin aditivos ni conservantes. Nos encanta llevar nuestros productos a tu casa.</p>
      <a href="/sobre-nosotros" class="qs-btn">Conocernos más →</a>
    </div>
    <div class="qs-icon">🌾</div>
  </div>
</section>

<footer>
  <p>© 2026 Plutarco Almacén · Coghlan, Buenos Aires</p>
</footer>


<section id="cart">
  <div class="cart-header">
    <div class="cart-header-title">🛒 Tu pedido</div>
    <button class="close-cart" onclick="toggleCart()">✕</button>
  </div>
  <div class="cart-body">
    <ul id="cart-items"></ul>
    <div id="cart-summary" class="cart-summary-inline"></div>
    <div class="cart-section-title">Datos de entrega</div>
    <div class="inputs">
      <label for="pickup-day">📅 Día de entrega</label>
      <select id="pickup-day" required>
        <option value="" disabled selected>Seleccionar una fecha</option>
      </select>
    </div>
    <div class="inputs-grid">
      <div class="inputs">
        <label for="name">👤 Nombre completo</label>
        <input type="text" id="name" placeholder="Tu nombre completo">
      </div>
      <div class="inputs">
        <label for="phone">☎️ Teléfono</label>
        <input type="tel" id="phone" placeholder="11 1234-5678">
      </div>
    </div>
    <div class="inputs">
      <label for="email">📧 Correo electrónico</label>
      <input type="email" id="email" placeholder="tuemail@ejemplo.com">
    </div>
    <div class="inputs">
      <label for="address">📍 Dirección de entrega</label>
      <input type="text" id="address" placeholder="Escribí tu dirección completa...">
    </div>
    <div class="inputs">
      <label for="comment">🏠 Depto / Piso / Aclaración</label>
      <input type="text" id="comment" placeholder="Ej: Depto 2B, timbre García">
    </div>
    <p id="envio-msg" class="envio-msg"></p>
    <div class="cart-aviso">
      <div class="cart-aviso-pago">💳 <strong>Solo transferencia bancaria.</strong> Te enviamos los datos al confirmar.</div>
      <div class="cart-aviso-stock">⚠️ Si algún producto no tiene stock, te avisamos y hacemos la devolución.</div>
    </div>
    <div class="cart-totales">
      <div class="cart-total-row"><span>Subtotal</span><span id="subtotal-display">$0</span></div>
      <div class="cart-total-row"><span>Envío</span><span id="envio-display">—</span></div>
      <div class="cart-total-row cart-total-main"><span>Total</span><span>$<span id="total">0</span></span></div>
    </div>
    <button class="finalize-btn" id="submit-btn" onclick="enviarPedido()">Confirmar pedido →</button>
    <button class="wsp-alt-btn" onclick="consultarWhatsApp()">💬 Consultar por WhatsApp</button>
  </div>
</section>

<div class="cart-overlay" id="cart-overlay" onclick="toggleCart()"></div>

<a href="https://wa.me/5491150168920?text=Hola! Vengo de la pagina web"
   class="whatsapp-float visible" id="boton-wpp" target="_blank" aria-label="WhatsApp">
  <img src="/media_static/whatsapp.png" alt="WhatsApp" class="whatsapp-icon">
</a>

<div class="pd-lightbox" id="pd-lightbox" onclick="pdCloseLightbox()">
  <button class="pd-lightbox-close" onclick="event.stopPropagation();pdCloseLightbox()">✕</button>
  <img id="pd-lightbox-img" src="" alt="{product.nombre}" onclick="event.stopPropagation()">
</div>

<div class="pd-toast" id="pd-toast"></div>


<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBVozj7g2eddN7aXyE8VeAaNKdPMtYdsQ4&libraries=places"></script>

<script type="module">
  import {{ fetchConfig, fetchProducts }}                          from '/tienda/static/js/api.js';
  import {{ loadCartFromSession }}                                 from '/tienda/static/js/state.js';
  import {{ updateCart, toggleCart, consultarWhatsApp }}           from '/tienda/static/js/cart.js';
  import {{ initAutocomplete, actualizarEnvio }}                   from '/tienda/static/js/shipping.js';
  import {{ cargarDiasEntrega, initFormValidation, enviarPedido }} from '/tienda/static/js/form.js';
  import {{ Ocultar, Mostrar }}                                    from '/tienda/static/js/utils.js';

  window.toggleCart        = toggleCart;
  window.consultarWhatsApp = consultarWhatsApp;
  window.enviarPedido      = enviarPedido;

  document.addEventListener('cart:changed', actualizarEnvio);


  const cartEl  = document.getElementById('cart');
  const overlay = document.getElementById('cart-overlay');
  const wppBtn  = document.getElementById('boton-wpp');
  if (cartEl && overlay) {{
    new MutationObserver(() => {{
      const open = cartEl.classList.contains('visible');
      overlay.classList.toggle('visible', open);
      if (wppBtn) open ? Ocultar(wppBtn) : Mostrar(wppBtn);
    }}).observe(cartEl, {{ attributes: true, attributeFilter: ['class'] }});
  }}

  const syncCount = () => {{
    try {{
      const c = JSON.parse(sessionStorage.getItem('plutarco_cart') || '{{}}');
      const t = Object.values(c).reduce((a, b) => a + b, 0);
      const el = document.getElementById('cart-count');
      if (el) el.textContent = t;
    }} catch(e) {{}}
  }};

  window._updateCart = () => {{
    loadCartFromSession();
    updateCart();
    syncCount();
  }};

  window.addEventListener('load', async () => {{
    await fetchConfig();
    await fetchProducts();
    loadCartFromSession();
    updateCart();
    cargarDiasEntrega();
    initAutocomplete();
    initFormValidation();
    syncCount();
  }});
</script>

<script>
  const PRODUCTO = {{
    id: '{product.codigo}',
    nombre: {json.dumps(product.nombre)},
    precio: {product.precio},
    imagen: {json.dumps(imagen)}
  }};
  const CART_KEY = 'plutarco_cart';
  let qty = 1;

  function changeQty(delta) {{
    qty = Math.max(1, qty + delta);
    document.getElementById('qty-display').textContent = qty;
  }}

  function volverATienda() {{
    const estado = JSON.parse(sessionStorage.getItem('tienda-estado') || '{{}}');
    var url = '/';
    if (estado.filter) url += `?cat=${{encodeURIComponent(estado.filter)}}`;
    if (estado.search) url += `&search=${{encodeURIComponent(estado.search)}}`;
    window.location.href = url;
  }}
  function agregarAlCarrito() {{
    try {{
      const raw  = sessionStorage.getItem(CART_KEY);
      const cart = raw ? JSON.parse(raw) : {{}};
      cart[PRODUCTO.id] = (cart[PRODUCTO.id] || 0) + qty;
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart));

      const total  = Object.values(cart).reduce((a, b) => a + b, 0);
      const bubble = document.getElementById('cart-count');
      if (bubble) {{
        bubble.textContent = total;
        bubble.style.transform = 'scale(1.4)';
        setTimeout(() => {{ bubble.style.transform = 'scale(1)'; }}, 220);
      }}

      if (typeof window._updateCart === 'function') window._updateCart();

      const en  = cart[PRODUCTO.id];
      const btn = document.getElementById('btn-agregar');
      btn.innerHTML = `✓ Agregado (${{en}} en carrito)`;
      btn.classList.add('agregado');
      setTimeout(() => {{
        btn.innerHTML = '🛒 Agregar al carrito';
        btn.classList.remove('agregado');
        sincronizarBoton();
      }}, 2500);

      pdShowToast(`${{qty}}× ${{PRODUCTO.nombre}} agregado 🛒`);
    }} catch(e) {{ console.error(e); }}
  }}

  function sincronizarBoton() {{
    try {{
      const cart = JSON.parse(sessionStorage.getItem(CART_KEY) || '{{}}');
      const en   = cart[PRODUCTO.id] || 0;
      const btn  = document.getElementById('btn-agregar');
      if (btn) btn.innerHTML = en > 0 ? `🛒 Agregar (${{en}} en carrito)` : '🛒 Agregar al carrito';
    }} catch(e) {{}}
  }}

  let _dt;
  function irABuscarDebounce(v) {{ clearTimeout(_dt); _dt = setTimeout(() => irABuscar(v), 600); }}
  function irABuscar(v) {{ if (v?.trim().length > 1) window.location.href = `/?search=${{encodeURIComponent(v.trim())}}`; }}

  function pdOpenLightbox(src) {{
    document.getElementById('pd-lightbox-img').src = src;
    document.getElementById('pd-lightbox').classList.add('open');
    document.addEventListener('keydown', _escLb);
  }}
  function pdCloseLightbox() {{
    document.getElementById('pd-lightbox').classList.remove('open');
    document.removeEventListener('keydown', _escLb);
  }}
  function _escLb(e) {{ if (e.key === 'Escape') pdCloseLightbox(); }}

  function pdShowToast(msg) {{
    const t = document.getElementById('pd-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }}

  document.addEventListener('DOMContentLoaded', sincronizarBoton);
</script>

</body>
</html>"""
    return html


@router.get("/{product_id:path}")
async def get_product_detail(product_id: str):
    with get_session() as session:
        product = session.exec(
            select(Product).where(Product.id == product_id)
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {product_id} no encontrado")
        return HTMLResponse(content=get_product_detail_html(product))