from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()
BASE = "app/admin"

@router.get("/")
async def productos_page():
    return FileResponse(os.path.join(BASE, "resumen.html"))
