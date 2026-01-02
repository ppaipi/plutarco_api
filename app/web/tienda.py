from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()
from app.config import DIR_TIENDA
@router.get("/")
async def tienda_page():
    return FileResponse(os.path.join(DIR_TIENDA + "/minorista", "index.html"))