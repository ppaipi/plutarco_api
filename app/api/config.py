from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from app.database import get_session
from sqlmodel import select
from app.models import Configuracion

router = APIRouter(prefix="/config", tags=["config"])


# GET /config/envio - Lee configuración de envío (id=1)
@router.get("/list")
def get_envio_config():
    with get_session() as s:
        config = s.exec(select(Configuracion).where(Configuracion.id == 1)).first()
        if not config:
            raise HTTPException(status_code=404, detail="Configuración no encontrada")

        # Retornar estructura nueva: envio_tarifas, dias_entrega, orden_categorias, orden_subcategorias, pedido_minimo
        return {
            "id": config.id,
            "envio_tarifas": config.envio_tarifas,
            "dias_entrega": config.dias_entrega,
            "orden_categorias": config.orden_categorias,
            "orden_subcategorias": config.orden_subcategorias,
            "pedido_minimo": config.pedido_minimo,
        }


# PUT /config/envio - Actualiza configuración de envío (id=1)
@router.put("/envio")
async def update_envio_config(payload: dict):
    with get_session() as s:
        config = s.exec(select(Configuracion).where(Configuracion.id == 1)).first()

        if not config:
            # Crear nueva si no existe; aceptar keys de la nueva estructura
            config = Configuracion(
                id=1,
                envio_tarifas=payload.get("envio_tarifas", []),
                dias_entrega=payload.get("dias_entrega", []),
                orden_categorias=payload.get("orden_categorias", []),
                orden_subcategorias=payload.get("orden_subcategorias", []),
                pedido_minimo=payload.get("pedido_minimo", 0),
            )
        else:
            # Actualizar solo campos permitidos
            allowed_keys = {"envio_tarifas", "dias_entrega", "orden_categorias", "orden_subcategorias", "pedido_minimo"}
            for key, value in payload.items():
                if key in allowed_keys:
                    setattr(config, key, value)

        s.add(config)
        s.commit()
        s.refresh(config)

        return {
            "ok": True,
            "id": config.id,
            "envio_tarifas": config.envio_tarifas,
            "dias_entrega": config.dias_entrega,
            "orden_categorias": config.orden_categorias,
            "orden_subcategorias": config.orden_subcategorias,
            "pedido_minimo": config.pedido_minimo,
        }


# GET /config/ - Lista todas las configuraciones
@router.get("/")
def list_all_configs():
    with get_session() as s:
        return s.exec(select(Configuracion).order_by(Configuracion.id.asc())).all()


# POST /config/ - Crea nueva configuración
@router.post("/")
async def create_config(payload: dict):
    with get_session() as s:
        config = Configuracion(**payload)
        s.add(config)
        s.commit()
        s.refresh(config)
        return config


# DELETE /config/{config_id} - Elimina configuración
@router.delete("/{config_id}", status_code=204)
async def delete_config(config_id: int):
    with get_session() as s:
        config = s.exec(select(Configuracion).where(Configuracion.id == config_id)).first()
        if not config:
            raise HTTPException(404, "Configuración no encontrada")
        s.delete(config)
        s.commit()
        return


# POST /config/init - Inicializa o reinicia la config id=1 con valores por defecto
@router.post("/init", status_code=200)
async def init_config(payload: dict = None):
    """
    Inicializa o reinicia la Configuracion id=1 con valores por defecto.
    Útil para preparar la DB después de cambios de schema.
    """
    with get_session() as s:
        config = s.exec(select(Configuracion).where(Configuracion.id == 1)).first()

        if not config:
            # Crear nueva
            config = Configuracion(
                id=1,
                envio_tarifas=payload.get("envio_tarifas", []) if payload else [],
                dias_entrega=payload.get("dias_entrega", []) if payload else [],
                orden_categorias=payload.get("orden_categorias", []) if payload else [],
                orden_subcategorias=payload.get("orden_subcategorias", []) if payload else [],
            )
        else:
            # Actualizar con valores de payload o mantener vacíos
            if payload:
                config.envio_tarifas = payload.get("envio_tarifas", config.envio_tarifas or [])
                config.dias_entrega = payload.get("dias_entrega", config.dias_entrega or [])
                config.orden_categorias = payload.get("orden_categorias", config.orden_categorias or [])
                config.orden_subcategorias = payload.get("orden_subcategorias", config.orden_subcategorias or [])

        s.add(config)
        s.commit()
        s.refresh(config)

        return {
            "ok": True,
            "message": "Configuración inicializada correctamente",
            "id": config.id,
            "envio_tarifas": config.envio_tarifas,
            "dias_entrega": config.dias_entrega,
            "orden_categorias": config.orden_categorias,
            "orden_subcategorias": config.orden_subcategorias,
            "pedido_minimo": config.pedido_minimo,
        }
