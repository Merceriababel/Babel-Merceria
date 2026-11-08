"""Ventas.

Rutas:
  POST /sales               registra una venta (aprobada o pendiente)
  GET  /sales?fecha=        ventas de un día con resumen por método de pago
  POST /sales/{id}/approve  aprueba una venta pendiente (descuenta stock)
  POST /sales/{id}/cancel   cancela una venta (devuelve el stock)     (admin)

Estados: pendiente (no toca stock) → aprobada (descuenta stock) → cancelada (devuelve stock).
"""
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import admin_only, current_user
from ..models import Sale, SaleItem, Variant
from ..schemas import SaleIn
from ..services import dates
from ..services.stock import move, notify_if_low

router = APIRouter(prefix="/sales", tags=["sales"])

METODOS = ("efectivo", "tarjeta", "transferencia")


def sale_out(s: Sale):
    """Una venta con sus renglones, lista para enviar al frontend."""
    return {
        "id": s.id,
        "hora": dates.local_iso(s.fecha),
        "metodo_pago": s.metodo_pago,
        "estado": s.estado,
        "total": float(s.total),
        "nro_operacion": s.nro_operacion,
        "observaciones": s.observaciones,
        "usuario": s.user.nombre,
        "items": [
            {
                "producto": i.variant.product.nombre,
                "color": i.variant.color,
                "unidad": i.variant.product.unidad,
                "cantidad": float(i.cantidad),
                "precio_unit": float(i.precio_unit),
                "subtotal": float(i.precio_unit * i.cantidad),
            }
            for i in s.items
        ],
    }


def _get(db: Session, sid: int) -> Sale:
    """Carga una venta con todo lo necesario para mostrarla, o responde 404."""
    venta = (
        db.query(Sale)
        .options(
            selectinload(Sale.items).selectinload(SaleItem.variant).selectinload(Variant.product),
            selectinload(Sale.user),
        )
        .filter(Sale.id == sid)
        .first()
    )
    if not venta:
        raise HTTPException(404, "Venta no encontrada")
    return venta


@router.post("")
def create_sale(data: SaleIn, db: Session = Depends(get_db), user=Depends(current_user)):
    """Registra una venta. Si queda 'aprobada', descuenta el stock de cada renglón."""
    venta = Sale(
        user_id=user.id, metodo_pago=data.metodo_pago, estado=data.estado,
        nro_operacion=data.nro_operacion, observaciones=data.observaciones, total=Decimal(0),
    )
    db.add(venta)
    db.flush()  # necesitamos el id de la venta para los renglones y el motivo del movimiento

    total = Decimal(0)
    alertas = []  # (stock anterior, variante) para avisar por correo después del commit

    for item in data.items:
        variante = db.get(Variant, item.variant_id)
        if not variante or not variante.product.activo:
            raise HTTPException(400, "Hay un producto que no está disponible")

        # Solo el admin puede cambiar el precio; el empleado vende siempre al precio de lista
        puede_cambiar_precio = item.precio_unit is not None and user.rol == "admin"
        precio = item.precio_unit if puede_cambiar_precio else variante.product.precio_venta

        db.add(
            SaleItem(
                sale_id=venta.id, variant_id=variante.id, cantidad=item.cantidad,
                precio_unit=precio, costo_unit=variante.product.precio_compra,  # costo congelado
            )
        )
        total += precio * item.cantidad

        if data.estado == "aprobada":
            stock_anterior = variante.stock_actual
            move(db, variante, "venta", -item.cantidad, f"Venta #{venta.id}", user.id)
            alertas.append((stock_anterior, variante))

    venta.total = total
    db.commit()

    for stock_anterior, variante in alertas:
        notify_if_low(stock_anterior, variante)
    return sale_out(_get(db, venta.id))


@router.get("")
def day_sales(fecha: str | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    """Ventas de un día (hoy por defecto) con cantidad, facturación e ingreso por método de pago."""
    dia = date.fromisoformat(fecha) if fecha else dates.now().date()
    desde, hasta = dates.day_range(dia)

    ventas = (
        db.query(Sale)
        .options(
            selectinload(Sale.items).selectinload(SaleItem.variant).selectinload(Variant.product),
            selectinload(Sale.user),
        )
        .filter(Sale.fecha >= desde, Sale.fecha < hasta)
        .order_by(Sale.id.desc())
        .all()
    )
    # Los totales cuentan solo ventas aprobadas
    aprobadas = [s for s in ventas if s.estado == "aprobada"]
    return {
        "fecha": dia.isoformat(),
        "cantidad": len(aprobadas),
        "total": float(sum(s.total for s in aprobadas)),
        "por_metodo": {m: float(sum(s.total for s in aprobadas if s.metodo_pago == m)) for m in METODOS},
        "ventas": [sale_out(s) for s in ventas],
    }


@router.post("/{sid}/approve")
def approve(sid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    """Aprueba una venta pendiente: descuenta el stock de todos sus renglones."""
    venta = _get(db, sid)
    if venta.estado != "pendiente":
        raise HTTPException(400, "Solo se pueden aprobar ventas pendientes")

    alertas = []
    for item in venta.items:
        stock_anterior = item.variant.stock_actual
        move(db, item.variant, "venta", -item.cantidad, f"Venta #{venta.id}", user.id, costo=item.costo_unit)
        alertas.append((stock_anterior, item.variant))
    venta.estado = "aprobada"
    db.commit()

    for stock_anterior, variante in alertas:
        notify_if_low(stock_anterior, variante)
    return sale_out(_get(db, sid))


@router.post("/{sid}/cancel")
def cancel(sid: int, db: Session = Depends(get_db), user=Depends(admin_only)):
    """Cancela una venta. Si estaba aprobada, devuelve el stock (movimiento 'devolucion')."""
    venta = _get(db, sid)
    if venta.estado == "cancelada":
        raise HTTPException(400, "La venta ya está cancelada")

    if venta.estado == "aprobada":
        for item in venta.items:
            move(db, item.variant, "devolucion", item.cantidad, f"Cancelación venta #{venta.id}",
                 user.id, costo=item.costo_unit)
    venta.estado = "cancelada"
    db.commit()
    return sale_out(_get(db, sid))
