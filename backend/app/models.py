"""Modelos de la base de datos (una clase = una tabla).

Si cambiás algo acá, también hay que reflejarlo en database/schema.sql
o generar una migración:  alembic revision --autogenerate -m "descripción"

Ideas clave del diseño:
  - El STOCK vive siempre en la variante (color). Un producto sin colores tiene una sola
    variante llamada "Único".
  - Todo cambio de stock queda registrado en StockMovement (historial y auditoría).
  - SaleItem guarda el costo del producto AL MOMENTO de vender, así la ganancia histórica
    no cambia aunque después cambie el precio de compra.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# Tipo numérico para dinero y cantidades: 12 dígitos, 2 decimales (permite 2,5 m o 0,25 kg)
NUM = Numeric(12, 2)


def fecha_col():
    """Columna de fecha/hora con zona horaria que la base completa sola con 'ahora'."""
    return mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------
class User(Base):
    """Usuario del sistema. Solo existen dos: uno 'admin' y uno 'empleado'."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))  # nunca se guarda la contraseña en claro
    rol: Mapped[str] = mapped_column(String(20))              # 'admin' | 'empleado'
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------
class Category(Base):
    """Categoría de productos (Telas, Lanas, Hilos, ...)."""
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True)


class Product(Base):
    """Producto del catálogo. El stock NO está acá: está en sus variantes."""
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), unique=True)       # código interno
    nombre: Mapped[str] = mapped_column(String(150))
    descripcion: Mapped[Optional[str]] = mapped_column(Text)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    unidad: Mapped[str] = mapped_column(String(2), default="u")       # 'm' metro | 'kg' kilo | 'u' unidad
    precio_compra: Mapped[Decimal] = mapped_column(NUM, default=Decimal(0))  # costo vigente
    precio_venta: Mapped[Decimal] = mapped_column(NUM, default=Decimal(0))
    stock_minimo: Mapped[Decimal] = mapped_column(NUM, default=Decimal(0))   # umbral de alerta (por color)
    imagen_url: Mapped[Optional[str]] = mapped_column(String(500))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[Optional[Category]] = relationship()
    variants: Mapped[list["Variant"]] = relationship(back_populates="product", cascade="all, delete-orphan")


class Variant(Base):
    """Variante de un producto (normalmente un color). Acá vive el stock."""
    __tablename__ = "variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    color: Mapped[str] = mapped_column(String(60), default="Único")
    codigo_color: Mapped[Optional[str]] = mapped_column(String(20))   # hexadecimal, ej. #B4432C
    imagen_url: Mapped[Optional[str]] = mapped_column(String(500))
    stock_actual: Mapped[Decimal] = mapped_column(NUM, default=Decimal(0))

    product: Mapped[Product] = relationship(back_populates="variants")


# ---------------------------------------------------------------------------
# Compras a proveedores
# ---------------------------------------------------------------------------
class Supplier(Base):
    """Proveedor / distribuidor."""
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    telefono: Mapped[Optional[str]] = mapped_column(String(40))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    direccion: Mapped[Optional[str]] = mapped_column(String(200))


class Purchase(Base):
    """Cabecera de una compra a un proveedor."""
    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))      # quién la registró
    fecha: Mapped[datetime] = fecha_col()
    total: Mapped[Decimal] = mapped_column(NUM, default=Decimal(0))
    notas: Mapped[Optional[str]] = mapped_column(String(300))

    supplier: Mapped[Supplier] = relationship()
    items: Mapped[list["PurchaseItem"]] = relationship(cascade="all, delete-orphan")


class PurchaseItem(Base):
    """Renglón de una compra: qué variante, cuánto y a qué costo."""
    __tablename__ = "purchase_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id"))
    variant_id: Mapped[int] = mapped_column(ForeignKey("variants.id"))
    cantidad: Mapped[Decimal] = mapped_column(NUM)
    costo_unit: Mapped[Decimal] = mapped_column(NUM)

    variant: Mapped[Variant] = relationship()


# ---------------------------------------------------------------------------
# Ventas
# ---------------------------------------------------------------------------
class Sale(Base):
    """Cabecera de una venta."""
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))      # quién vendió
    fecha: Mapped[datetime] = fecha_col()
    metodo_pago: Mapped[str] = mapped_column(String(20))              # 'efectivo' | 'tarjeta' | 'transferencia'
    estado: Mapped[str] = mapped_column(String(20))                   # 'pendiente' | 'aprobada' | 'cancelada'
    nro_operacion: Mapped[Optional[str]] = mapped_column(String(60))
    observaciones: Mapped[Optional[str]] = mapped_column(String(300))
    total: Mapped[Decimal] = mapped_column(NUM, default=Decimal(0))

    user: Mapped[User] = relationship()
    items: Mapped[list["SaleItem"]] = relationship(cascade="all, delete-orphan")


class SaleItem(Base):
    """Renglón de una venta."""
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"))
    variant_id: Mapped[int] = mapped_column(ForeignKey("variants.id"))
    cantidad: Mapped[Decimal] = mapped_column(NUM)
    precio_unit: Mapped[Decimal] = mapped_column(NUM)   # precio al que se vendió
    costo_unit: Mapped[Decimal] = mapped_column(NUM)    # costo al momento de vender (para la ganancia)

    variant: Mapped[Variant] = relationship()


# ---------------------------------------------------------------------------
# Movimientos de stock
# ---------------------------------------------------------------------------
class StockMovement(Base):
    """Historial de TODO cambio de stock (compras, ventas, ajustes, pérdidas, roturas)."""
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("variants.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    fecha: Mapped[datetime] = fecha_col()
    # Tipos: compra | venta | devolucion | ajuste_entrada | ajuste_salida | perdida | rotura
    tipo: Mapped[str] = mapped_column(String(20))
    cantidad: Mapped[Decimal] = mapped_column(NUM)      # con signo: positivo entra, negativo sale
    motivo: Mapped[str] = mapped_column(String(200), default="")
    costo_unit: Mapped[Decimal] = mapped_column(NUM, default=Decimal(0))  # sirve para valuar las pérdidas

    variant: Mapped[Variant] = relationship()
    user: Mapped[User] = relationship()
