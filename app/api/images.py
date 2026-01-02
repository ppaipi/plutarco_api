from fastapi import status, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
import os
from app.config import IMAGES_DIR
from app.database import get_session
from app.models import Product
from sqlmodel import select


router = APIRouter(prefix="/images", tags=["images"])


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    filename = file.filename
    safe_path = os.path.join(IMAGES_DIR, filename)
    # opcional: renombrar si existe para evitar colisiones
    if os.path.exists(safe_path):
        base, ext = os.path.splitext(filename)
        i = 1
        while True:
            new_name = f"{base}-{i}{ext}"
            new_path = os.path.join(IMAGES_DIR, new_name)
            if not os.path.exists(new_path):
                safe_path = new_path
                filename = new_name
                break
            i += 1
    with open(safe_path, "wb") as f:
        content = await file.read()
        f.write(content)
    # devuelve ruta para acceder (usa el endpoint existente /images/{filename})
    return {"filename": filename, "url": f"/images/{filename}"}


@router.post("/upload/{codigo}/", status_code=status.HTTP_201_CREATED)
async def upload_image_for_product(codigo: str, file: UploadFile = File(...)):
    # validate extension
    name = file.filename or ''
    ext = os.path.splitext(name)[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado")

    # construct filename based on product code to keep one image per product
    filename = f"{codigo}{ext}"
    path = os.path.join(IMAGES_DIR, filename)

    # save file (overwrite existing)
    try:
        content = await file.read()
        with open(path, 'wb') as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando archivo: {e}")

    # update product record imagen_url
    try:
        with get_session() as s:
            stmt = select(Product).where(Product.codigo == codigo)
            prod = s.exec(stmt).first()
            if not prod:
                # if product not found, still return URL but inform caller
                url = f"/images/{filename}"
                return JSONResponse(status_code=201, content={"filename": filename, "url": url, "warning": "Producto no encontrado"})
            prod.imagen_url = f"/images/{filename}"
            s.add(prod)
            s.commit()
            s.refresh(prod)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error actualizando producto: {e}")

    return {"filename": filename, "url": f"/images/{filename}"}

@router.get("/{filename}")
def serve_image(filename: str):
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Imagen no encontrada")
    return FileResponse(path)

@router.delete("/{filename}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(filename: str):
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Imagen no encontrada")
    os.remove(path)
    with get_session() as s:
        stmt = select(Product).where(Product.imagen_url == f"/images/{filename}")
        productos = s.exec(stmt).all()
        for prod in productos:
            prod.imagen_url = None
            s.add(prod)
        s.commit()
    return
