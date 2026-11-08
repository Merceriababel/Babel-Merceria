"""Dashboard, ganancias/pérdidas y reportes.

Definiciones (importantes para mantener coherencia):
  - Ventas:    suma del total de ventas APROBADAS.
  - Ganancia:  Σ (precio de venta − costo al momento de vender) × cantidad, solo ventas aprobadas.
  - Compras:   suma del total de compras a proveedores.
  - Pérdidas:  movimientos de tipo pérdida, rotura y ajuste de salida, valuados a su costo.
  - Neta:      ganancia − pérdidas.

Rutas:
  GET /reports/dashboard   resumen general (el empleado no ve costos ni ganancias)
  GET /reports/profit      totales de un día, mes o año            (admin)
  GET /reports/monthly     comparativa mes a mes de un año         (admin)
  GET /reports/top         top 10 productos más vendidos           (admin)
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import admin_only, current_user
from ..models import Product, Purchase, Sale, SaleItem, StockMovement, Variant
from ..services import dates
from ..services.serialize import low_list

router = APIRouter(prefix="/reports", tags=["reports"])

# Tipos de movimiento que cuentan como pérdida
PERDIDAS = ("perdida", "rotura", "ajuste_salida")


def f(x):
    """Convierte a float tratando None como 0 (las sumas de SQL devuelven None si no hay filas)."""
    return float(x or 0)


def ventas_dia(db: Session, desde, hasta):
    """Cantidad y total de ventas aprobadas en un rango."""
    cantidad, total = (
        db.query(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
        .filter(Sale.estado == "aprobada", Sale.fecha >= desde, Sale.fecha < hasta)
        .one()
    )
    return {"cantidad": cantidad, "total": f(total)}


def totals(db: Session, desde, hasta):
    """Calcula ventas, compras, ganancia, pérdidas y ganancia neta de un rango de fechas."""
    ventas_ok = (Sale.estado == "aprobada", Sale.fecha >= desde, Sale.fecha < hasta)

    ventas = db.query(func.coalesce(func.sum(Sale.total), 0)).filter(*ventas_ok).scalar()

    ganancia = (
        db.query(func.coalesce(func.sum((SaleItem.precio_unit - SaleItem.costo_unit) * SaleItem.cantidad), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(*ventas_ok)
        .scalar()
    )
    compras = (
        db.query(func.coalesce(func.sum(Purchase.total), 0))
        .filter(Purchase.fecha >= desde, Purchase.fecha < hasta)
        .scalar()
    )
    # La cantidad de las salidas es negativa: se invierte el signo para sumar pérdidas en positivo
    perdidas = (
        db.query(func.coalesce(func.sum(-StockMovement.cantidad * StockMovement.costo_unit), 0))
        .filter(StockMovement.tipo.in_(PERDIDAS), StockMovement.fecha >= desde, StockMovement.fecha < hasta)
        .scalar()
    )
    return {
        "ventas": f(ventas), "compras": f(compras), "ganancia": f(ganancia),
        "perdidas": f(perdidas), "neta": f(ganancia) - f(perdidas),
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user=Depends(current_user)):
    """Resumen general. El bloque `mes` (compras, ganancias, pérdidas) solo lo recibe el admin."""
    ahora = dates.now()
    stock_total = (
        db.query(func.coalesce(func.sum(Variant.stock_actual), 0))
        .join(Product)
        .filter(Product.activo.is_(True))
        .scalar()
    )
    bajos = low_list(db)
    salida = {
        "stock_total": f(stock_total),
        "ventas_hoy": ventas_dia(db, *dates.day_range(ahora.date())),
        "bajo_count": len(bajos),
        "bajo": bajos[:8],  # el panel muestra los 8 más urgentes
    }
    if user.rol == "admin":
        salida["mes"] = totals(db, *dates.month_range(ahora.year, ahora.month))
    return salida


@router.get("/profit")
def profit(
    periodo: str = Query("mes", pattern="^(dia|mes|anio)$"),
    fecha: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(admin_only),
):
    """Totales del día, mes o año que contiene `fecha` (hoy por defecto)."""
    d = date.fromisoformat(fecha) if fecha else dates.now().date()
    rangos = {
        "dia": lambda: dates.day_range(d),
        "mes": lambda: dates.month_range(d.year, d.month),
        "anio": lambda: dates.year_range(d.year),
    }
    return totals(db, *rangos[periodo]())


@router.get("/monthly")
def monthly(year: int | None = None, db: Session = Depends(get_db), user=Depends(admin_only)):
    """Ventas, compras y ganancia de cada mes del año (para el gráfico comparativo)."""
    anio = year or dates.now().year
    desde, hasta = dates.year_range(anio)

    def mes(columna):
        """Número de mes (1-12) de una columna de fecha, en hora local del negocio."""
        return func.extract("month", func.timezone(settings.TIMEZONE, columna))

    mes_venta, mes_compra = mes(Sale.fecha), mes(Purchase.fecha)

    ventas = {
        int(m): f(v)
        for m, v in db.query(mes_venta, func.sum(Sale.total))
        .filter(Sale.estado == "aprobada", Sale.fecha >= desde, Sale.fecha < hasta)
        .group_by(mes_venta)
        .all()
    }
    ganancia = {
        int(m): f(v)
        for m, v in db.query(mes_venta, func.sum((SaleItem.precio_unit - SaleItem.costo_unit) * SaleItem.cantidad))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.estado == "aprobada", Sale.fecha >= desde, Sale.fecha < hasta)
        .group_by(mes_venta)
        .all()
    }
    compras = {
        int(m): f(v)
        for m, v in db.query(mes_compra, func.sum(Purchase.total))
        .filter(Purchase.fecha >= desde, Purchase.fecha < hasta)
        .group_by(mes_compra)
        .all()
    }
    return [
        {"mes": m, "ventas": ventas.get(m, 0), "compras": compras.get(m, 0), "ganancia": ganancia.get(m, 0)}
        for m in range(1, 13)
    ]


@router.get("/top")
def top(dias: int = Query(30, ge=1, le=366), db: Session = Depends(get_db), user=Depends(admin_only)):
    """Top 10 productos por ingreso en los últimos `dias` días (solo ventas aprobadas)."""
    desde = dates.now() - timedelta(days=dias)
    ingreso = func.sum(SaleItem.precio_unit * SaleItem.cantidad)

    filas = (
        db.query(Product.nombre, Product.unidad, func.sum(SaleItem.cantidad), ingreso)
        .join(Variant, Variant.id == SaleItem.variant_id)
        .join(Product, Product.id == Variant.product_id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.estado == "aprobada", Sale.fecha >= desde)
        .group_by(Product.id, Product.nombre, Product.unidad)
        .order_by(desc(ingreso))
        .limit(10)
        .all()
    )
    return [
        {"producto": nombre, "unidad": unidad, "cantidad": f(cant), "ingreso": f(ing)}
        for nombre, unidad, cant, ing in filas
    ]
