"""Reglas de negocio del stock.

REGLA DE ORO: el stock de una variante solo se modifica llamando a `move()`.
Así cada cambio queda registrado en el historial (StockMovement) y nunca se pierde la trazabilidad.
"""
from decimal import Decimal

from fastapi import HTTPException

from ..config import settings
from ..models import StockMovement
from .dates import now
from .mail import send_mail

# Orden de gravedad para ordenar listados (primero lo más urgente)
ORDEN = {"critico": 0, "bajo": 1, "normal": 2}


def estado(stock, minimo) -> str:
    """Clasifica el nivel de stock de una variante.

    - critico: sin stock, o menos del 25 % del mínimo.
    - bajo:    igual o menor al mínimo.
    - normal:  por encima del mínimo.
    """
    stock, minimo = float(stock or 0), float(minimo or 0)
    if stock <= 0 or (minimo > 0 and stock <= minimo * 0.25):
        return "critico"
    if stock <= minimo:
        return "bajo"
    return "normal"


def move(db, variant, tipo: str, cantidad: Decimal, motivo: str, user_id: int, costo=None):
    """Aplica un movimiento de stock y lo registra en el historial.

    - `cantidad` lleva signo: positivo entra mercadería, negativo sale.
    - `costo` es el costo unitario a registrar; si no se indica, usa el costo vigente del producto.
    - Si el stock quedaría negativo, responde 400 y no cambia nada.
    """
    nuevo = (variant.stock_actual or Decimal(0)) + cantidad
    if nuevo < 0:
        raise HTTPException(
            400, f"Stock insuficiente: {variant.product.nombre} {variant.color} (hay {variant.stock_actual})"
        )
    variant.stock_actual = nuevo
    db.add(
        StockMovement(
            variant_id=variant.id,
            user_id=user_id,
            tipo=tipo,
            cantidad=cantidad,
            motivo=motivo,
            costo_unit=variant.product.precio_compra if costo is None else costo,
        )
    )


def notify_if_low(stock_anterior, variant):
    """Envía el aviso de stock bajo SOLO cuando el stock cruza el mínimo hacia abajo.

    Evita mandar un correo en cada venta posterior mientras el producto siga bajo.
    Se llama DESPUÉS del commit, con el stock que había antes del movimiento.
    """
    minimo = variant.product.stock_minimo
    if stock_anterior > minimo and variant.stock_actual <= minimo:
        send_mail(
            settings.ALERT_EMAIL,
            f"Stock bajo: {variant.product.nombre} {variant.color}",
            f"Producto: {variant.product.nombre} ({variant.color})\n"
            f"Stock disponible: {variant.stock_actual} {variant.product.unidad}\n"
            f"Stock mínimo: {minimo}\n"
            f"Fecha: {now():%d/%m/%Y %H:%M}\n",
        )
