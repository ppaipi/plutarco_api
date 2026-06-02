from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()

@router.get("/")
async def analytics_page():
    return FileResponse("app/admin/html/analytics.html")