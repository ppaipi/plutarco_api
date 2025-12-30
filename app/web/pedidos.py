from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()
from app.config import DIR_WEB

@router.get("/")
async def pedidos_page():
    return FileResponse(os.path.join(DIR_WEB, "pedidos.html"))
