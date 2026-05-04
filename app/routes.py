from fastapi import APIRouter
from fastapi.responses import FileResponse, Response
import os

from app.api.products import router as products_router
from app.api.orders import router as orders_router
from app.api.login import router as login_router
from app.api.images import router as images_router
from app.api.config import router as config_router

from app.web.pedidos import router as pedidos_router
from app.web.productos import router as productos_router
from app.web.configuracion import router as configuracion_router
from app.web.tienda import router as tienda_router
from app.web.resumen import router as resumen_router
from app.web.mayorista import router as mayorista_router
from app.web.producto_detalle import router as producto_detalle_router
from app.config import DIR_TIENDA
from fastapi.responses import Response, PlainTextResponse
from app.models import Product
from app.database import get_session
from sqlmodel import select
from datetime import datetime

# Agregar headers para caché
""" from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZIPMiddleware

app.add_middleware(GZIPMiddleware, minimum_size=1000)  # Comprime respuestas
 """
api_router = APIRouter()

@api_router.get("/")
async def root():
    return FileResponse(os.path.join(DIR_TIENDA + "/minorista", "index.html"))
@api_router.get("/sobre-nosotros")
async def sobre_nosotros():
    return FileResponse(os.path.join(DIR_TIENDA + "/sobre-nosotros", "index.html"))

# WEB
api_router.include_router(productos_router, prefix="/productos", tags=["productos"])
api_router.include_router(producto_detalle_router, prefix="/producto", tags=["productos"])
api_router.include_router(pedidos_router, prefix="/pedidos", tags=["pedidos"])
api_router.include_router(configuracion_router, prefix="/configuracion", tags=["configuracion"])
api_router.include_router(tienda_router, prefix="/tienda", tags=["tienda"])
api_router.include_router(resumen_router, prefix="/resumen", tags=["resumen"])
api_router.include_router(mayorista_router, prefix="/mayorista", tags=["mayorista"])

# API
api_router.include_router(products_router)
api_router.include_router(orders_router)
api_router.include_router(login_router)
api_router.include_router(images_router)
api_router.include_router(config_router)

# Página de detalles del producto (DEBE IR AL FINAL - CATCH-ALL)
# app/routes.py - AGREGA ESTO:

@api_router.get("/sitemap.xml")
async def sitemap_xml():
    with get_session() as session:
        products = session.exec(
            select(Product).where(Product.habilitado == True)
        ).all()

    hoy = datetime.utcnow().strftime("%Y-%m-%d")

    urls = []

    # Home
    urls.append(f"""
    <url>
    <loc>https://plutarcoalmacen.com.ar/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>{hoy}</lastmod>
    </url>
    """)

    # Página estática
    urls.append(f"""
    <url>
    <loc>https://plutarcoalmacen.com.ar/sobre-nosotros.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
    </url>
    """)

    # Productos
    for p in products:
        lastmod = hoy  # reemplazar por p.updated_at si tenés

        urls.append(f"""
        <url>
        <loc>https://plutarcoalmacen.com.ar/{p.id}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
        <lastmod>{lastmod}</lastmod>
        </url>
        """)

    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    {''.join(urls)}
    </urlset>
    '''

    return Response(content=xml, media_type="application/xml")

@api_router.get("/robots.txt")
async def robots():
    content = """User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://plutarcoalmacen.com.ar/sitemap.xml"""
    return Response(content=content, media_type="text/plain")