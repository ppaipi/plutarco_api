# app/main.py

import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routes import api_router
from app.config import API_KEY, PROTECTED_PATHS, PUBLIC_PATHS


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


# ===================== API KEY MIDDLEWARE =====================
@app.middleware("http")
async def api_key_middleware(request: Request, call_next):

    # ✅ DEJAR PASAR PREFLIGHT
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path

    if any(path.startswith(p) for p in PUBLIC_PATHS):
        return await call_next(request)

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

    return await call_next(request)


# ===================== ROUTES =====================
app.include_router(api_router)
