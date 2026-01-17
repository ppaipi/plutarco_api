# app/main.py

import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routes import api_router
from app.config import API_KEY, PROTECTED_PATHS, PUBLIC_PATHS
from app.config import IMAGES_DIR
from app.purge_cache import purgue_cache


# ===================== APP =====================
app = FastAPI(
    title="API Plutarco Almacén"
)


# ===================== CORS =====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Wildcard origins con credentials=True no es permitido por browsers
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================== STARTUP =====================
@app.on_event("startup")
def startup():
    try:
        init_db()
    except Exception as e:
        # nunca frenar el arranque por DB
        print("Error initializing DB:", e)
    try:
        purgue_cache()
    except Exception as e:
        print("Error purging cache on startup:", e)
    


# ===================== STATIC FILES =====================
# Admin panel
app.mount(
    "/static",
    StaticFiles(directory="app/admin"),
    name="static"
)
app.mount(
    "/tienda/static",
    StaticFiles(directory="app/tienda"),
    name="static"
)

# Media files (uploads / assets)
MEDIA_DIR = os.getenv("MEDIA_DIR", "/data/media")
os.makedirs(MEDIA_DIR, exist_ok=True)

app.mount(
    "/media",
    StaticFiles(directory=MEDIA_DIR),
    name="media"
)

# Montar imágenes estáticas accesibles en /media_static (usa IMAGES_DIR)
app.mount(
    "/media_static",
    StaticFiles(directory="app/media_static"),
    name="media_static"
)


# ===================== API KEY MIDDLEWARE =====================
@app.middleware("http")
async def api_key_middleware(request: Request, call_next):

    # ✅ DEJAR PASAR PREFLIGHT
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if any(path.startswith(p) for p in PROTECTED_PATHS):
        key = request.headers.get("x-api-key")

        if key != API_KEY:
            response = JSONResponse(
                {"error": "Acceso denegado, se necesita API KEY en el header"},
                status_code=401
            )

            # CORS headers MANUALES (por si corta acá)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"

            return response
    if any(path.startswith(p) for p in PUBLIC_PATHS):
        return await call_next(request)


    return await call_next(request)





# ===================== ROUTES =====================
app.include_router(api_router)
