"""Conversión de modelos a diccionarios JSON para las respuestas de la API.

Se arman a mano (en vez de usar esquemas automáticos) para controlar qué ve cada rol:
el EMPLEADO nunca recibe `precio_compra` (el costo).
"""
from sqlalchemy.orm import selectinload

from ..models import Product, Variant
from .stock import ORDEN, estado


def variant_out(v, p=None):
    """Una variante (color) con su stock y su estado (normal/bajo/crítico)."""
    p = p or v.product
    return {
        "id": v.id,
        "product_id": v.product_id,
        "color": v.color,
        "codigo_color": v.codigo_color,
        "imagen_url": v.imagen_url,
        "stock_actual": float(v.stock_actual),
        "estado": estado(v.stock_actual, p.stock_minimo),
    }


def product_out(p, admin=False):
    """Un producto con sus variantes. Solo el admin recibe el precio de compra."""
    variantes = [variant_out(v, p) for v in sorted(p.variants, key=lambda v: v.id)]
    data = {
        "id": p.id,
        "codigo": p.codigo,
        "nombre": p.nombre,
        "descripcion": p.descripcion,
        "category_id": p.category_id,
        "categoria": p.category.nombre if p.category else None,
        "unidad": p.unidad,
        "precio_venta": float(p.precio_venta),
        "stock_minimo": float(p.stock_minimo),
        "imagen_url": p.imagen_url,
        "activo": p.activo,
        "stock_total": sum(v["stock_actual"] for v in variantes),
        # El estado del producto es el de su peor variante
        "estado": min((v["estado"] for v in variantes), key=ORDEN.get, default="normal"),
        "variants": variantes,
    }
    if admin:
        data["precio_compra"] = float(p.precio_compra)
    return data


def low_list(db):
    """Variantes con stock bajo o crítico (de productos activos), las más urgentes primero."""
    filas = (
        db.query(Variant)
        .join(Product)
        .filter(Product.activo.is_(True))
        .options(selectinload(Variant.product))
        .all()
    )
    salida = []
    for v in filas:
        if estado(v.stock_actual, v.product.stock_minimo) != "normal":
            salida.append(
                {
                    **variant_out(v),
                    "producto": v.product.nombre,
                    "unidad": v.product.unidad,
                    "stock_minimo": float(v.product.stock_minimo),
                }
            )
    return sorted(salida, key=lambda x: (ORDEN[x["estado"]], x["stock_actual"]))
