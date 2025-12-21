from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()
BASE = "app/tienda"

@router.get("/")
async def tienda_page():
    return FileResponse(os.path.join(BASE, "index.html"))