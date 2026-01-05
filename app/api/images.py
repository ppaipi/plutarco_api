from fastapi import status, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
import os
from app.config import IMAGES_DIR
from app.database import get_session
from app.models import Product
from sqlmodel import select
from PIL import Image
from io import BytesIO


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


def optimize_image(file):
    image = Image.open(file.file)
    original_format = image.format.upper()

    # Redimensionar sin deformar
    image.thumbnail((800, 800))

    buffer = BytesIO()

    # Detectar transparencia
    has_alpha = (
        image.mode in ("RGBA", "LA") or
        (image.mode == "P" and "transparency" in image.info)
    )

    # ---- PNG ----
    if original_format == "PNG":
        if has_alpha:
            # Mantener PNG si tiene transparencia
            image.save(buffer, format="PNG", optimize=True)
        else:
            # Convertir a JPG si no necesita transparencia
            image = image.convert("RGB")
            image.save(buffer, format="JPEG", quality=85, optimize=True)

    # ---- JPG / JPEG ----
    elif original_format in ("JPG", "JPEG"):
        image = image.convert("RGB")  # seguridad
        image.save(buffer, format="JPEG", quality=85, optimize=True)

    # ---- WEBP ----
    elif original_format == "WEBP":
        image.save(buffer, format="WEBP", quality=80, method=6)

    else:
        raise ValueError("Formato de imagen no soportado")

    buffer.seek(0)
    return buffer.getvalue()


@router.post("/upload/{codigo}/", status_code=status.HTTP_201_CREATED)
async def upload_image_for_product(codigo: str, file: UploadFile = File(...)):
    # validate extension
    name = file.filename or ''
    ext = os.path.splitext(name)[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado")

    # filename
    filename = f"{codigo}{ext}"
    path = os.path.join(IMAGES_DIR, filename)

    try:
        optimized_bytes = optimize_image(file)

        with open(path, "wb") as f:
            f.write(optimized_bytes)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando archivo: {e}")

    # update product record imagen_url
    try:
        with get_session() as s:
            prod = s.exec(
                select(Product).where(Product.codigo == codigo)
            ).first()

            url = f"/images/{filename}"

            if not prod:
                return JSONResponse(
                    status_code=201,
                    content={
                        "filename": filename,
                        "url": url,
                        "warning": "Producto no encontrado"
                    }
                )

            prod.imagen_url = url
            s.add(prod)
            s.commit()

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
