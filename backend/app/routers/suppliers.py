"""Proveedores (solo administrador).

Rutas:
  GET  /suppliers        lista con cantidad de compras y gasto acumulado
  POST /suppliers        crea un proveedor
  PUT  /suppliers/{id}   edita un proveedor
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import admin_only
from ..models import Purchase, Supplier
from ..schemas import SupplierIn

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def out(s: Supplier, compras: int = 0, gastos=0):
    """Un proveedor con su historial resumido (cantidad de compras y gasto acumulado)."""
    return {
        "id": s.id, "nombre": s.nombre, "telefono": s.telefono, "email": s.email,
        "direccion": s.direccion, "compras": compras, "gastos": float(gastos),
    }


@router.get("")
def list_suppliers(db: Session = Depends(get_db), user=Depends(admin_only)):
    filas = (
        db.query(Supplier, func.count(Purchase.id), func.coalesce(func.sum(Purchase.total), 0))
        .outerjoin(Purchase, Purchase.supplier_id == Supplier.id)  # outer: incluye proveedores sin compras
        .group_by(Supplier.id)
        .order_by(Supplier.nombre)
        .all()
    )
    return [out(s, cantidad, gastos) for s, cantidad, gastos in filas]


@router.post("")
def create(data: SupplierIn, db: Session = Depends(get_db), user=Depends(admin_only)):
    proveedor = Supplier(**data.model_dump())
    db.add(proveedor)
    db.commit()
    return out(proveedor)


@router.put("/{sid}")
def update(sid: int, data: SupplierIn, db: Session = Depends(get_db), user=Depends(admin_only)):
    proveedor = db.get(Supplier, sid)
    if not proveedor:
        raise HTTPException(404, "Proveedor no encontrado")
    for campo, valor in data.model_dump().items():
        setattr(proveedor, campo, valor)
    db.commit()
    return out(proveedor)
