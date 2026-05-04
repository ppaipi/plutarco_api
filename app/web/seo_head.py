"""
Reemplazá la función get_product_detail_html() en tu product_detail.py
con esta versión mejorada para SEO.

Los cambios respecto a la anterior:
1. Schema.org más completo (BreadcrumbList + Product)
2. Meta description con palabras clave naturales
3. Título más descriptivo para Google
4. Canonical URL correcta
5. hreflang para Argentina
"""

import json
from app.models import Product

BASE_URL = "https://plutarcoalmacen.com.ar"

def build_meta_description(product: Product) -> str:
    """Genera una meta description natural con palabras clave."""
    desc = product.descripcion or ""
    # Si tiene descripción propia, la usamos (truncada a 155 chars)
    if len(desc) > 40:
        base = desc[:152].rsplit(" ", 1)[0] + "..."
    else:
        # Generamos una descripción útil
        base = (
            f"Comprá {product.nombre} en Plutarco Almacén. "
            f"Productos {product.categoria or 'naturales'} con delivery a domicilio en CABA. "
            f"Precio: ${product.precio:,.0f}."
        )
    return base[:160]


def build_page_title(product: Product) -> str:
    """Título optimizado para CTR en Google."""
    precio = f"${product.precio:,.0f}"
    cat = product.categoria or "Almacén natural"
    # Formato: Nombre | Precio | Marca - max ~60 chars
    title = f"{product.nombre} · {precio} | Plutarco Almacén Coghlan"
    return title[:70]


def build_schema(product: Product, imagen: str) -> dict:
    """Schema.org completo: Product + BreadcrumbList."""
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Product",
                "@id": f"{BASE_URL}/{product.id}#product",
                "name": product.nombre,
                "description": product.descripcion or "",
                "image": [imagen],
                "sku": product.codigo,
                "category": product.categoria or "",
                "brand": {
                    "@type": "Brand",
                    "name": "Plutarco Almacén"
                },
                "offers": {
                    "@type": "Offer",
                    "@id": f"{BASE_URL}/{product.id}#offer",
                    "url": f"{BASE_URL}/{product.id}",
                    "priceCurrency": "ARS",
                    "price": str(product.precio),
                    "priceValidUntil": "2026-12-31",
                    "itemCondition": "https://schema.org/NewCondition",
                    "availability": "https://schema.org/InStock",
                    "seller": {
                        "@type": "Organization",
                        "name": "Plutarco Almacén",
                        "url": BASE_URL
                    },
                    "hasMerchantReturnPolicy": {
                        "@type": "MerchantReturnPolicy",
                        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow"
                    }
                }
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Inicio",
                        "item": BASE_URL
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": product.categoria or "Productos",
                        "item": f"{BASE_URL}/?cat={product.categoria or ''}"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": product.nombre,
                        "item": f"{BASE_URL}/{product.id}"
                    }
                ]
            },
            {
                "@type": "Organization",
                "@id": f"{BASE_URL}/#org",
                "name": "Plutarco Almacén",
                "url": BASE_URL,
                "logo": f"{BASE_URL}/media_static/iconpng.ico",
                "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "+54-9-11-5016-8920",
                    "contactType": "customer service",
                    "availableLanguage": "Spanish"
                },
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Ibera 3852",
                    "addressLocality": "Coghlan",
                    "addressRegion": "Buenos Aires",
                    "addressCountry": "AR"
                }
            }
        ]
    }


def get_head_tags(product: Product, imagen: str) -> str:
    """Retorna todos los <meta> y <script> para el <head>."""
    title       = build_page_title(product)
    description = build_meta_description(product)
    canonical   = f"{BASE_URL}/{product.id}"
    schema      = build_schema(product, imagen)

    return f"""
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="keywords"    content="{product.nombre}, {product.categoria or ''}, {product.subcategoria or ''}, almacen natural, delivery CABA, Coghlan, organico, integral">
  <meta name="author"      content="Plutarco Almacén">
  <meta name="robots"      content="index, follow, max-image-preview:large">
  <link rel="canonical"    href="{canonical}">
  <link rel="alternate"    hreflang="es-ar" href="{canonical}">

  <!-- Open Graph -->
  <meta property="og:type"        content="product">
  <meta property="og:title"       content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image"       content="{imagen}">
  <meta property="og:image:width" content="800">
  <meta property="og:image:height" content="800">
  <meta property="og:url"         content="{canonical}">
  <meta property="og:site_name"   content="Plutarco Almacén">
  <meta property="og:locale"      content="es_AR">
  <meta property="product:price:amount"   content="{product.precio}">
  <meta property="product:price:currency" content="ARS">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image"       content="{imagen}">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
  {json.dumps(schema, ensure_ascii=False, indent=2)}
  </script>
"""