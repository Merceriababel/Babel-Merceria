"""Compras a distribuidores (solo administrador).

Registrar una compra: suma stock, guarda el gasto y actualiza el costo vigente del producto.

Rutas:
  POST /purchases   registra una compra
  GET  /purchases   historial (últimas 100)
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import admin_only
from ..models import Purchase, PurchaseItem, Supplier, Variant
from ..schemas import PurchaseIn
from ..services.dates import local_iso
from ..services.stock import move

router = APIRouter(prefix="/purchases", tags=["purchases"])


def purchase_out(p: Purchase):
    """Una compra con sus renglones."""
    return {
        "id": p.id,
        "fecha": local_iso(p.fecha),
        "proveedor": p.supplier.nombre,
        "total": float(p.total),
        "notas": p.notas,
        "items": [
            {
                "producto": i.variant.product.nombre,
                "color": i.variant.color,
                "cantidad": float(i.cantidad),
                "costo_unit": float(i.costo_unit),
            }
            for i in p.items
        ],
    }


@router.post("")
def create_purchase(data: PurchaseIn, db: Session = Depends(get_db), user=Depends(admin_only)):
    if not db.get(Supplier, data.supplier_id):
        raise HTTPException(400, "Proveedor no encontrado")

    compra = Purchase(supplier_id=data.supplier_id, user_id=user.id, notas=data.notas, total=Decimal(0))
    db.add(compra)
    db.flush()  # id de la compra para los renglones y el motivo del movimiento

    total = Decimal(0)
    for item in data.items:
        variante = db.get(Variant, item.variant_id)
        if not variante:
            raise HTTPException(400, "Variante no encontrada")

        db.add(PurchaseItem(purchase_id=compra.id, variant_id=variante.id,
                            cantidad=item.cantidad, costo_unit=item.costo_unit))
        total += item.cantidad * item.costo_unit

        # Efectos de la compra: aumenta el stock (queda en el historial)...
        move(db, variante, "compra", item.cantidad, f"Compra #{compra.id}", user.id, costo=item.costo_unit)
        # ...y el último costo pagado pasa a ser el costo vigente del producto
        variante.product.precio_compra = item.costo_unit

    compra.total = total
    db.commit()
    return {"id": compra.id, "total": float(total)}


@router.get("")
def list_purchases(db: Session = Depends(get_db), user=Depends(admin_only)):
    compras = (
        db.query(Purchase)
        .options(
            selectinload(Purchase.supplier),
            selectinload(Purchase.items).selectinload(PurchaseItem.variant).selectinload(Variant.product),
        )
        .order_by(Purchase.id.desc())
        .limit(100)
        .all()
    )
    return [purchase_out(p) for p in compras]
