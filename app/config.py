import os
from dotenv import load_dotenv

load_dotenv()

IMAGES_DIR = "/data/images"
os.makedirs(IMAGES_DIR, exist_ok=True)

PEDIDOS_PATH = "app/admin/pedidos/pedidos.html"

PRODUCTOS_PATH = "app/admin/productos/productos.html"

ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")
API_KEY = os.getenv("API_KEY")
PUBLIC_PATHS = [
    "/products",
    "/products/enabled",
    "/products/by-codigo/",
    "/images/",
    "/tienda",
    "/",
    "/orders",
]
PROTECTED_PATHS = [
    "/products/import",  # productos públicos (categorías/subcategorías no requieren API KEY)
    "/orders/",  # proteger subrutas (ej. /orders/1, /orders/import-excel) pero permitir POST a /orders
    "/config/envio",  # Proteger solo la API de config, no el HTML
    "/images/delete/",
    "/images/upload/",
]
BASE = "app/admin"