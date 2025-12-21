from fastapi import status, APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi import Form
from app.config import ADMIN_USER, ADMIN_PASS, API_KEY
import os
from ..config import BASE

router = APIRouter(prefix="/login", tags=["login"])



@router.get("/")
async def login_page():
    return FileResponse(os.path.join(BASE, "login.html"))

@router.post("/auth/")
def admin_login(username: str = Form(...), password: str = Form(...)):
    if username == ADMIN_USER and password == ADMIN_PASS:
        return {"access_token": API_KEY}
    raise HTTPException(401, "Credenciales incorrectas")