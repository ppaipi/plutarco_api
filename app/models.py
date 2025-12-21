# app/models.py
from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import date
from sqlalchemy import Column
from sqlalchemy import JSON as SA_JSON

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(index=True)
    nombre: str
    descripcion: Optional[str] = ""
    categoria: Optional[str] = ""
    subcategoria: Optional[str] = ""
    precio: float = 0.0
    proveedor: Optional[str] = ""

    # Nuevos campos pedidos
    habilitado: bool = Field(default=True, index=True)   # true = habilitado
    orden: Optional[int] = Field(default=None, index=True)  # orden de visibilidad (1,2,3,...)
    imagen_url: str | None = None

class OrderProduct(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: Optional[int] = Field(default=None, foreign_key="order.id")
    product_id: Optional[int] = Field(default=None, foreign_key="product.id")
    codigo: Optional[str] = ""        # guardamos también código y nombre por snapshot
    nombre: Optional[str] = ""
    cantidad: int = 1
    precio_unitario: float = 0.0
    subtotal: float = 0.0            # cantidad * precio_unitario
def recompute_totals(self):
    self.subtotal = sum((p.cantidad or 0) * (p.precio_unitario or 0) for p in self.productos)
    self.total = self.subtotal + (self.envio_cobrado or 0)

class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dia_entrega: Optional[date] = None
    nombre_completo: str
    correo: str
    telefono: Optional[str] = ""
    direccion: Optional[str] = ""
    comentario: Optional[str] = ""
    subtotal: float = 0.0
    envio_cobrado: float = 0.0
    costo_envio_real: float = 0.0
    total: float = 0.0
    confirmado: bool = False
    entregado: bool = False

    productos: List[OrderProduct] = Relationship(sa_relationship_kwargs={"cascade":"all, delete-orphan"})


# Moldelo: Dias: [1,3,5], Horas: [1, 10; 3, 12; 5, 14]
class Configuracion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Guardamos la configuración en campos JSON para estructuras complejas
    # envio_tarifas: lista de objetos {km: number, price: number}
    envio_tarifas: Optional[list] = Field(default_factory=list, sa_column=Column(SA_JSON))
    # dias_entrega: lista de objetos {weekday: 0..6, cutoff: "HH:MM"}
    dias_entrega: Optional[list] = Field(default_factory=list, sa_column=Column(SA_JSON))
    orden_categorias: Optional[list] = Field(default_factory=list, sa_column=Column(SA_JSON))
    orden_subcategorias: Optional[list] = Field(default_factory=list, sa_column=Column(SA_JSON))
    pedido_minimo: Optional[float] = Field(default=0.0)  # Monto mínimo de pedido