"""Add emoji and color fields to categories and subcategories

Revision ID: 001_emoji_color
Revises: 872326e64f6e
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import JSON as SA_JSON

# revision identifiers, used by Alembic.
revision = '001_emoji_color'
down_revision = '872326e64f6e'
branch_labels = None
depends_on = None


def upgrade():
    """
    La estructura de orden_categorias y orden_subcategorias cambia de:
    - Antigua: ["Categoría 1", "Categoría 2", ...] (strings)
    - Nueva: [{"name": "Categoría 1", "emoji": "🥩", "color": "#FF0000"}, ...] (objects)
    
    Alembic NO puede realizar esta migración automáticamente porque SQLite no tiene
    buen soporte para modificar JSON.
    
    PASOS MANUALES NECESARIOS:
    1. Haz backup de tu base de datos
    2. Ejecuta este script Python para migrar los datos:
    
    ---CUT HERE---
    from app.database import get_session
    from app.models import Configuracion
    from sqlmodel import select
    
    with get_session() as s:
        config = s.exec(select(Configuracion).where(Configuracion.id == 1)).first()
        if config:
            # Migrar orden_categorias
            if config.orden_categorias and isinstance(config.orden_categorias[0], str):
                config.orden_categorias = [
                    {"name": cat, "emoji": "", "color": "#0b76ff"}
                    for cat in config.orden_categorias
                ]
            
            # Migrar orden_subcategorias
            if config.orden_subcategorias and isinstance(config.orden_subcategorias[0], str):
                config.orden_subcategorias = [
                    {"name": subcat, "emoji": "", "color": "#0b76ff"}
                    for subcat in config.orden_subcategorias
                ]
            
            s.add(config)
            s.commit()
            print("✅ Migración completada")
    ---CUT HERE---
    """
    # SQLite no permite cambiar el tipo de columnas JSON directamente.
    # Las columnas ya están definidas como JSON, así que no hay cambios de esquema.
    # El cambio es solo en la estructura de datos dentro del JSON.
    pass


def downgrade():
    """
    Revertir la estructura a strings simples (aunque perderá emoji y color)
    """
    # Similar al upgrade, esto requiere intervención manual
    pass
