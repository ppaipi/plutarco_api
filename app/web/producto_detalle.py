from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from app.models import Product
from app.database import get_session
from sqlmodel import select
import json

router = APIRouter()

CART_STORAGE_KEY = 'plutarco_cart'

def get_product_detail_html(product: Product) -> str:

    imagen    = product.imagen_url or "/media_static/placeholder.jpg"
    descripcion = (product.descripcion or "Sin descripción disponible.").replace('\n', '<br>')
    categoria   = product.categoria   or ""
    subcategoria = product.subcategoria or ""

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

    subcategoria_badge = f'<span class="meta-badge">📂 {subcategoria}</span>' if subcategoria else ''

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{product.nombre} | Plutarco Almacén</title>
  <link rel="icon" type="image/jpeg" href="/media_static/icon.ico">
  <meta name="description" content="{(product.descripcion or '')[:160]}">
  <meta property="og:title"       content="{product.nombre} | Plutarco Almacén">
  <meta property="og:description" content="{(product.descripcion or '')[:160]}">
  <meta property="og:image"       content="{imagen}">
  <meta property="og:url"         content="https://plutarcoalmacen.com.ar/{product.id}">
  <meta property="og:type"        content="product">
  <link rel="canonical"           href="https://plutarcoalmacen.com.ar/{product.id}">
  <script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    /* ── Variables (misma paleta que la tienda) ── */
    :root {{
      --azul:    #1A5C78;
      --azul-dk: #124460;
      --amber:   #C8863A;
      --crema:   #F4F0E8;
      --carta:   #FFFCF7;
      --borde:   #d4ccbf;
      --gris-c:  #e6e0d4;
      --gris-m:  #c0b8aa;
      --gris-o:  #2C2C2C;
      --rojo:    #c0392b;
      --footer:  #0e3347;
    }}

    *, *::before, *::after {{ margin:0; padding:0; box-sizing:border-box; }}

    body {{
      background: var(--crema);
      color: var(--gris-o);
      font-family: 'Quicksand', sans-serif;
      min-height: 100vh;
    }}

    /* ── HEADER ── */
    header {{
      background: var(--azul);
      position: sticky; top: 0; z-index: 500;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      padding: 0.6rem 1.4rem;
      display: flex; align-items: center; gap: 1rem;
    }}

    .header-logo {{
      display: flex; align-items: center; gap: 0.55rem;
      text-decoration: none; flex-shrink: 0;
    }}
    .header-logo img {{ height: 36px; border-radius: 6px; }}
    .header-logo strong {{ color:#fff; font-size:0.95rem; white-space:nowrap; }}
    .header-logo span {{ color:rgba(255,255,255,0.6); font-size:0.7rem; display:block; }}

    .header-back {{
      margin-left: auto;
      color: rgba(255,255,255,0.88);
      text-decoration: none;
      font-size: 0.84rem;
      font-weight: 600;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.22);
      padding: 0.32rem 0.9rem;
      border-radius: 2rem;
      transition: background 0.15s;
      flex-shrink: 0;
    }}
    .header-back:hover {{ background: rgba(255,255,255,0.22); }}

    /* ── BREADCRUMB ── */
    .breadcrumb {{
      max-width: 1100px; margin: 0 auto;
      padding: 0.8rem 1.4rem 0;
      font-size: 0.78rem; color: var(--gris-m);
    }}
    .breadcrumb a {{ color: var(--azul); text-decoration: none; font-weight: 600; }}
    .breadcrumb a:hover {{ text-decoration: underline; }}
    .breadcrumb span {{ margin: 0 0.3rem; }}

    /* ── MAIN GRID ── */
    .pd-wrap {{
      max-width: 1100px;
      margin: 1.2rem auto 2rem;
      padding: 0 1.4rem;
    }}

    .pd-grid {{
      display: grid;
      grid-template-columns: 480px 1fr;
      gap: 2.4rem;
      background: var(--carta);
      border-radius: 1.2rem;
      border: 1px solid var(--borde);
      box-shadow: 0 2px 14px rgba(0,0,0,0.06);
      overflow: hidden;
    }}

    /* ── IMAGEN ── */
    .pd-img-wrap {{
      position: relative;
      background: linear-gradient(135deg, #f0f4f7, #e8ecee);
      display: flex; align-items: center; justify-content: center;
      min-height: 460px;
      overflow: hidden;
    }}

    .pd-img {{
      width: 100%; height: 100%;
      object-fit: cover;
      cursor: zoom-in;
      transition: transform 0.3s ease;
    }}
    .pd-img:hover {{ transform: scale(1.03); }}

    /* ── INFO ── */
    .pd-info {{
      padding: 2rem 2rem 2rem 0.5rem;
      display: flex; flex-direction: column; gap: 0;
    }}

    .pd-badges {{
      display: flex; flex-wrap: wrap; gap: 0.4rem;
      margin-bottom: 1rem;
    }}

    .meta-badge {{
      background: #eef5f8;
      border: 1px solid #cce0ea;
      padding: 0.28rem 0.85rem;
      border-radius: 2rem;
      font-size: 0.75rem;
      color: var(--azul);
      font-weight: 700;
    }}

    .pd-nombre {{
      font-size: 1.65rem;
      font-weight: 700;
      color: var(--gris-o);
      line-height: 1.22;
      margin-bottom: 0.5rem;
    }}

    .pd-precio {{
      font-size: 2rem;
      font-weight: 700;
      color: var(--azul-dk);
      margin: 1rem 0;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--gris-c);
    }}

    .pd-desc-label {{
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--azul);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 0.5rem;
    }}

    .pd-desc {{
      background: #fafaf7;
      border-left: 3px solid var(--amber);
      border-radius: 0 0.5rem 0.5rem 0;
      padding: 1rem 1.1rem;
      font-size: 0.9rem;
      line-height: 1.7;
      color: #444;
      margin-bottom: 1.5rem;
      flex: 1;
    }}

    /* ── CONTROLES ── */
    .pd-actions {{ display: flex; flex-direction: column; gap: 0.75rem; }}

    /* Contador */
    .qty-row {{
      display: flex; align-items: center; gap: 0.6rem;
    }}
    .qty-label {{ font-size: 0.8rem; font-weight: 600; color: var(--gris-m); }}
    .qty-ctrl {{
      display: flex; align-items: center; gap: 0;
      background: #fff; border: 2px solid var(--azul);
      border-radius: 2rem; overflow: hidden;
    }}
    .qty-btn {{
      background: none; border: none;
      width: 36px; height: 36px;
      font-size: 1.2rem; font-weight: 700;
      color: var(--azul); cursor: pointer;
      transition: background 0.12s;
      display: flex; align-items: center; justify-content: center;
    }}
    .qty-btn:hover {{ background: #eef5f8; }}
    .qty-num {{
      min-width: 36px; text-align: center;
      font-size: 1rem; font-weight: 700;
      color: var(--azul-dk);
    }}

    /* Botón agregar */
    .btn-agregar {{
      background: var(--azul);
      color: #fff; border: none;
      padding: 0.9rem 1.5rem;
      border-radius: 2rem;
      font-weight: 700; font-size: 1rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: background 0.18s, transform 0.12s;
      box-shadow: 0 4px 14px rgba(26,92,120,0.18);
      font-family: 'Quicksand', sans-serif;
    }}
    .btn-agregar:hover {{ background: var(--azul-dk); transform: translateY(-2px); }}

    .btn-agregar.agregado {{
      background: #27ae60;
      animation: pulse 0.4s ease;
    }}

    @keyframes pulse {{
      0%   {{ transform: scale(1); }}
      50%  {{ transform: scale(1.04); }}
      100% {{ transform: scale(1); }}
    }}

    /* Botón wsp */
    .btn-wsp {{
      background: none;
      color: #25D366; border: 1.5px solid #25D366;
      padding: 0.65rem 1.5rem;
      border-radius: 2rem;
      font-weight: 700; font-size: 0.9rem;
      cursor: pointer; text-decoration: none;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: background 0.15s, color 0.15s;
      font-family: 'Quicksand', sans-serif;
    }}
    .btn-wsp:hover {{ background: #25D366; color: #fff; }}

    /* Feedback toast */
    .toast {{
      position: fixed; bottom: 1.5rem; left: 50%;
      transform: translateX(-50%) translateY(80px);
      background: var(--azul-dk); color: #fff;
      padding: 0.7rem 1.4rem; border-radius: 2rem;
      font-size: 0.9rem; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      z-index: 9000;
      transition: transform 0.3s ease, opacity 0.3s ease;
      opacity: 0;
      white-space: nowrap;
    }}
    .toast.show {{
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }}

    /* ── FOOTER ── */
    footer {{
      background: var(--footer);
      color: #b8d8e8;
      text-align: center;
      padding: 1.2rem 1rem;
      font-size: 0.82rem;
      margin-top: 2rem;
    }}
    footer a {{ color: #b8d8e8; text-decoration: none; font-weight: 600; }}
    footer a:hover {{ text-decoration: underline; }}

    /* ── RESPONSIVE ── */
    @media (max-width: 900px) {{
      .pd-grid {{
        grid-template-columns: 1fr;
        gap: 0;
      }}
      .pd-img-wrap {{ min-height: 320px; }}
      .pd-info {{ padding: 1.5rem; }}
      .pd-nombre {{ font-size: 1.4rem; }}
      .pd-precio {{ font-size: 1.7rem; }}
    }}

    @media (max-width: 500px) {{
      .pd-wrap {{ padding: 0 0.6rem; margin-top: 0.8rem; }}
      .pd-img-wrap {{ min-height: 260px; }}
      .pd-nombre {{ font-size: 1.2rem; }}
      .pd-precio {{ font-size: 1.5rem; }}
    }}

    /* ── LIGHTBOX zoom ── */
    .lightbox {{
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.82);
      z-index: 15000;
      align-items: center; justify-content: center;
      cursor: zoom-out;
    }}
    .lightbox.open {{ display: flex; }}
    .lightbox img {{
      max-width: 92vw; max-height: 90vh;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      cursor: default;
    }}
    .lightbox-close {{
      position: fixed; top: 18px; right: 18px;
      background: rgba(255,255,255,0.15); color: #fff;
      border: none; border-radius: 50%;
      width: 36px; height: 36px; font-size: 1.2rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }}
    .lightbox-close:hover {{ background: rgba(255,255,255,0.28); }}
  </style>
</head>

<body>

  <!-- HEADER -->
  <header>
    <a href="/" class="header-logo">
      <img src="/media_static/iconpng.ico" alt="Plutarco">
      <div>
        <strong>Plutarco Almacén</strong>
        <span>Coghlan · CABA</span>
      </div>
    </a>
    <a href="/" class="header-back">← Volver al catálogo</a>
  </header>

  <!-- BREADCRUMB -->
  <div class="breadcrumb">
    <a href="/">Inicio</a>
    <span>›</span>
    <a href="/?cat={categoria}">{categoria}</a>
    {'<span>›</span><span>' + subcategoria + '</span>' if subcategoria else ''}
    <span>›</span>
    <span>{product.nombre}</span>
  </div>

  <!-- PRODUCTO -->
  <div class="pd-wrap">
    <div class="pd-grid">

      <!-- Imagen -->
      <div class="pd-img-wrap">
        <img
          id="pd-main-img"
          src="{imagen}"
          alt="{product.nombre}"
          class="pd-img"
          onclick="openLightbox(this.src)"
          onerror="this.src='/media_static/placeholder.jpg'">
      </div>

      <!-- Info -->
      <div class="pd-info">

        <div class="pd-badges">
          <span class="meta-badge">🗂 {categoria}</span>
          {subcategoria_badge}
        </div>

        <h1 class="pd-nombre">{product.nombre}</h1>

        <div class="pd-precio">${product.precio:,.0f}</div>

        <div class="pd-desc-label">Descripción</div>
        <div class="pd-desc">{descripcion}</div>

        <div class="pd-actions">

          <div class="qty-row">
            <span class="qty-label">Cantidad:</span>
            <div class="qty-ctrl">
              <button class="qty-btn" onclick="changeQty(-1)">−</button>
              <span class="qty-num" id="qty-display">1</span>
              <button class="qty-btn" onclick="changeQty(1)">+</button>
            </div>
          </div>

          <button class="btn-agregar" id="btn-agregar" onclick="agregarAlCarrito()">
            🛒 Agregar al carrito
          </button>

          <a class="btn-wsp"
             href="https://wa.me/5491150168920?text=Hola! Quiero consultar sobre: {product.nombre} (${product.precio:,.0f})"
             target="_blank">
            💬 Consultar por WhatsApp
          </a>

        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <footer>
    <p>🌵 <strong>Plutarco Almacén Delivery</strong> · Panadería integral y Almacén Orgánico · Coghlan, CABA</p>
    <p style="margin-top:0.4rem"><a href="/">Inicio</a> &nbsp;·&nbsp; <a href="/sobre-nosotros.html">Sobre nosotros</a></p>
  </footer>

  <!-- LIGHTBOX -->
  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <button class="lightbox-close" onclick="closeLightbox()">✕</button>
    <img id="lightbox-img" src="" alt="{product.nombre}" onclick="event.stopPropagation()">
  </div>

  <!-- TOAST -->
  <div class="toast" id="toast"></div>

  <script>
    // ── Datos del producto ──
    const PRODUCTO = {{
      id:     '{product.codigo}',
      nombre: {json.dumps(product.nombre)},
      precio: {product.precio},
      imagen: {json.dumps(imagen)}
    }};

    const CART_KEY = 'plutarco_cart';
    let qty = 1;

    // ── Cantidad ──
    function changeQty(delta) {{
      qty = Math.max(1, qty + delta);
      document.getElementById('qty-display').textContent = qty;
    }}

    // ── Carrito (sessionStorage — mismo que la tienda) ──
    function agregarAlCarrito() {{
      try {{
        const raw  = sessionStorage.getItem(CART_KEY);
        const cart = raw ? JSON.parse(raw) : {{}};
        cart[PRODUCTO.id] = (cart[PRODUCTO.id] || 0) + qty;
        sessionStorage.setItem(CART_KEY, JSON.stringify(cart));

        // Feedback visual
        const btn = document.getElementById('btn-agregar');
        btn.textContent = '✓ Agregado al carrito';
        btn.classList.add('agregado');
        setTimeout(() => {{
          btn.innerHTML = '🛒 Agregar al carrito';
          btn.classList.remove('agregado');
        }}, 2000);

        showToast(`${{qty}}x ${{PRODUCTO.nombre}} agregado al carrito`);

      }} catch(e) {{
        console.error('Error al agregar al carrito:', e);
        showToast('Error al agregar. Intentá de nuevo.');
      }}
    }}

    function showToast(msg) {{
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2800);
    }}

    // ── Lightbox ──
    function openLightbox(src) {{
      document.getElementById('lightbox-img').src = src;
      document.getElementById('lightbox').classList.add('open');
      document.addEventListener('keydown', escLightbox);
    }}

    function closeLightbox() {{
      document.getElementById('lightbox').classList.remove('open');
      document.removeEventListener('keydown', escLightbox);
    }}

    function escLightbox(e) {{
      if (e.key === 'Escape') closeLightbox();
    }}

    // ── Mostrar cantidad actual en el carrito si ya existe ──
    window.addEventListener('DOMContentLoaded', () => {{
      try {{
        const raw  = sessionStorage.getItem(CART_KEY);
        const cart = raw ? JSON.parse(raw) : {{}};
        const enCarrito = cart[PRODUCTO.id] || 0;
        if (enCarrito > 0) {{
          const btn = document.getElementById('btn-agregar');
          btn.innerHTML = `🛒 Agregar (${{enCarrito}} en carrito)`;
        }}
      }} catch(e) {{}}
    }});
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