from fastapi import APIRouter
from fastapi.responses import FileResponse
import os
from app.config import DIR_WEB
router = APIRouter()

@router.get("/")
async def configuracion_page():
    return FileResponse(os.path.join(DIR_WEB, "configuracion.html"))
