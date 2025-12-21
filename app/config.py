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
PROTECTED_PATHS = [
    "/products/import",  # productos públicos (categorías/subcategorías no requieren API KEY)
    "/orders",
    "/config/envio",  # Proteger solo la API de config, no el HTML
    "/images/delete/",
    "/images/upload/",
]
BASE = "app/admin"