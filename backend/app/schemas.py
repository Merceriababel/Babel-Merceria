"""Esquemas de ENTRADA de la API (lo que el frontend envía).

FastAPI valida automáticamente cada pedido contra estas clases y responde 422 si algo no cumple.
Las respuestas se arman a mano en services/serialize.py y en cada router.
"""
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# --- Autenticación ---
class LoginIn(BaseModel):
    email: str
    password: str


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    token: str                              # token recibido por correo
    password: str = Field(min_length=6)


class ChangePassIn(BaseModel):
    actual: str
    nueva: str = Field(min_length=6)


# --- Productos ---
class VariantIn(BaseModel):
    id: Optional[int] = None                # con id: se edita esa variante; sin id: se crea una nueva
    color: str = "Único"
    codigo_color: Optional[str] = None
    imagen_url: Optional[str] = None
    stock_inicial: Decimal = Decimal(0)     # solo se usa al CREAR la variante


class ProductIn(BaseModel):
    codigo: str = Field(min_length=1)
    nombre: str = Field(min_length=1)
    descripcion: Optional[str] = None
    category_id: Optional[int] = None
    unidad: str = Field(default="u", pattern="^(m|kg|u)$")
    precio_compra: Decimal = Field(default=Decimal(0), ge=0)
    precio_venta: Decimal = Field(default=Decimal(0), ge=0)
    stock_minimo: Decimal = Field(default=Decimal(0), ge=0)
    imagen_url: Optional[str] = None
    activo: bool = True
    variants: list[VariantIn] = []


class CategoryIn(BaseModel):
    nombre: str = Field(min_length=1)


# --- Proveedores ---
class SupplierIn(BaseModel):
    nombre: str = Field(min_length=1)
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None


# --- Stock ---
class AdjustIn(BaseModel):
    variant_id: int
    tipo: str = Field(pattern="^(ajuste_entrada|ajuste_salida|perdida|rotura)$")
    cantidad: Decimal = Field(gt=0)         # siempre positiva: el signo lo define el tipo
    motivo: str = ""


# --- Ventas ---
class SaleItemIn(BaseModel):
    variant_id: int
    cantidad: Decimal = Field(gt=0)
    precio_unit: Optional[Decimal] = None   # solo lo respeta si quien vende es admin


class SaleIn(BaseModel):
    metodo_pago: str = Field(pattern="^(efectivo|tarjeta|transferencia)$")
    estado: str = Field(default="aprobada", pattern="^(pendiente|aprobada)$")
    nro_operacion: Optional[str] = None
    observaciones: Optional[str] = None
    items: list[SaleItemIn] = Field(min_length=1)


# --- Compras ---
class PurchaseItemIn(BaseModel):
    variant_id: int
    cantidad: Decimal = Field(gt=0)
    costo_unit: Decimal = Field(ge=0)


class PurchaseIn(BaseModel):
    supplier_id: int
    notas: Optional[str] = None
    items: list[PurchaseItemIn] = Field(min_length=1)
