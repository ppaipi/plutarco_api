# app/models.py
from typing import List, Optional
from datetime import date

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy import JSON as SA_JSON


# -------------------------
# PRODUCTOS
# -------------------------
class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: str = Field(primary_key=True, index=True)

    codigo: str = Field(index=True)
    nombre: str
    descripcion: Optional[str] = ""
    categoria: Optional[str] = ""
    subcategoria: Optional[str] = ""
    precio: float = 0.0
    proveedor: Optional[str] = ""

    habilitado: bool = Field(default=True, index=True)
    orden: Optional[int] = Field(default=None, index=True)
    imagen_url: Optional[str] = None


# -------------------------
# RELACIÓN PEDIDO ↔ PRODUCTO
# -------------------------
class OrderProduct(SQLModel, table=True):
    __tablename__ = "order_products"

    id: Optional[int] = Field(default=None, primary_key=True)

    order_id: Optional[int] = Field(default=None, foreign_key="orders.id")
    product_id: Optional[str] = Field(default=None, foreign_key="products.id")

    # Snapshot del producto al momento del pedido
    codigo: Optional[str] = ""
    nombre: Optional[str] = ""

    cantidad: int = 1
    precio_unitario: int = 0
    subtotal: int = 0

    order: Optional["Order"] = Relationship(back_populates="productos")


# -------------------------
# PEDIDOS
# -------------------------
class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: Optional[int] = Field(default=None, primary_key=True)

    dia_pedido: Optional[date] = None
    dia_entrega: Optional[date] = None

    nombre_completo: str
    correo: str
    telefono: Optional[str] = ""
    direccion: Optional[str] = ""
    comentario: Optional[str] = ""

    subtotal: int = 0
    envio_cobrado: int = 0
    costo_envio_real: int = 0
    total: int = 0

    confirmado: bool = False
    entregado: bool = False

    productos: List[OrderProduct] = Relationship(
        back_populates="order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    empleado_asignado: Optional[list[int]] = Field(default=None, sa_column=Column(SA_JSON))

    def recompute_totals(self) -> None:
        self.subtotal = sum(
            (p.cantidad or 0) * (p.precio_unitario or 0)
            for p in self.productos
        )
        self.total = self.subtotal + (self.envio_cobrado or 0)


# -------------------------
# CONFIGURACIÓN GENERAL
# -------------------------
class Configuracion(SQLModel, table=True):
    __tablename__ = "configuracion"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Ej: [{ "km": 1, "price": 2000 }, ...]
    envio_tarifas: Optional[list] = Field(
        default_factory=list,
        sa_column=Column(SA_JSON),
    )

    # Ej: [{ "weekday": 0, "cutoff": "12:00" }, ...]
    dias_entrega: Optional[list] = Field(
        default_factory=list,
        sa_column=Column(SA_JSON),
    )

    orden_categorias: Optional[list] = Field(
        default_factory=list,
        sa_column=Column(SA_JSON),
    )

    orden_subcategorias: Optional[list] = Field(
        default_factory=list,
        sa_column=Column(SA_JSON),
    )

    pedido_minimo: Optional[int] = Field(default=0)

    status: Optional[bool] = Field(default=True)
    # True = Tienda Abierta
    # False = Tienda Cerrada
    mensage_status: Optional[str] = Field(default="")

    #{1: "juan", 2: "maria"}
    empleados: Optional[dict[int, str]] = Field(
        default_factory=dict,
        sa_column=Column(SA_JSON),
    )
