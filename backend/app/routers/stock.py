"""Control de stock: alertas, historial de movimientos y ajustes manuales.

Rutas:
  GET  /stock/low        variantes con stock bajo o crítico
  GET  /stock/movements  historial de movimientos                 (admin)
  POST /stock/adjust     ajuste, pérdida o rotura manual          (admin)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import admin_only, current_user
from ..models import StockMovement, Variant
from ..schemas import AdjustIn
from ..services.dates import local_iso
from ..services.serialize import low_list
from ..services.stock import move, notify_if_low

router = APIRouter(prefix="/stock", tags=["stock"])

# Signo de cada tipo de ajuste: +1 suma stock, -1 resta
SIGNO = {"ajuste_entrada": 1, "ajuste_salida": -1, "perdida": -1, "rotura": -1}


@router.get("/low")
def low(db: Session = Depends(get_db), user=Depends(current_user)):
    """Panel de alertas: productos críticos y bajos con la cantidad restante."""
    return low_list(db)


@router.get("/movements")
def movements(
    variant_id: int | None = None,
    limit: int = 150,
    db: Session = Depends(get_db),
    user=Depends(admin_only),
):
    """Historial: fecha, usuario, producto, tipo, cantidad y motivo (más recientes primero)."""
    consulta = (
        db.query(StockMovement)
        .options(selectinload(StockMovement.variant).selectinload(Variant.product), selectinload(StockMovement.user))
        .order_by(StockMovement.id.desc())
    )
    if variant_id:
        consulta = consulta.filter(StockMovement.variant_id == variant_id)

    return [
        {
            "id": m.id,
            "fecha": local_iso(m.fecha),
            "usuario": m.user.nombre,
            "producto": m.variant.product.nombre,
            "color": m.variant.color,
            "unidad": m.variant.product.unidad,
            "tipo": m.tipo,
            "cantidad": float(m.cantidad),
            "motivo": m.motivo,
        }
        for m in consulta.limit(min(limit, 500))
    ]


@router.post("/adjust")
def adjust(data: AdjustIn, db: Session = Depends(get_db), user=Depends(admin_only)):
    """Registra un ajuste manual, una pérdida o una rotura (la cantidad se envía siempre positiva)."""
    variante = db.get(Variant, data.variant_id)
    if not variante:
        raise HTTPException(404, "Variante no encontrada")

    stock_anterior = variante.stock_actual
    motivo = data.motivo or data.tipo.replace("_", " ")
    move(db, variante, data.tipo, SIGNO[data.tipo] * data.cantidad, motivo, user.id)
    db.commit()

    notify_if_low(stock_anterior, variante)  # aviso por correo si cruzó el mínimo
    return {"ok": True, "stock_actual": float(variante.stock_actual)}
