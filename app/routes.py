from fastapi import APIRouter
from fastapi.responses import FileResponse
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
from app.config import DIR_TIENDA

api_router = APIRouter()

@api_router.get("/")
async def root():
    return FileResponse(os.path.join(DIR_TIENDA + "/minorista", "index.html"))


# WEB
api_router.include_router(productos_router, prefix="/productos", tags=["productos"])
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
