import os
from dotenv import load_dotenv

# ===============================
# ENV
# ===============================
load_dotenv()

# ===============================
# ENTORNO (Fly vs Local)
# ===============================
IS_FLY = os.getenv("FLY_APP_NAME") is not None

if IS_FLY:
    BASE_DATA_DIR = "/data"
else:
    BASE_DATA_DIR = os.path.join(os.getcwd(), "data")

# ===============================
# DIRECTORIOS
# ===============================
IMAGES_DIR = os.path.join(BASE_DATA_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

# ===============================
# WEB / HTML
# ===============================
PRODUCTOS_PATH = "app/admin/productos/productos.html"
DIR_WEB = "app/admin/html"
DIR_TIENDA = "app/tienda"

# ===============================
# AUTH / SECURITY
# ===============================
ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")
API_KEY = os.getenv("API_KEY")

# ===============================
# RUTAS PUBLICAS
# ===============================
PUBLIC_PATHS = [
    "/products",
    "/products/enabled",
    "/products/by-codigo/",
    "/images/",
    "/tienda",
    "/",
    "/orders",  # ⚠️ solo POST público, subrutas protegidas
]

# ===============================
# RUTAS PROTEGIDAS
# ===============================
PROTECTED_PATHS = [
    "/products/import",
    "/orders/",
    "/config/envio",
    "/images/delete/",
    "/images/upload/",
]
