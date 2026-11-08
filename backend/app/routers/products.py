"""Productos, variantes (colores) y categorías.

Rutas:
  GET  /categories          lista de categorías
  POST /categories          crea una categoría                      (admin)
  GET  /products            lista/busca productos (empleado: solo activos y sin costo)
  GET  /products/{id}       un producto
  POST /products            crea producto con sus variantes         (admin)
  PUT  /products/{id}       edita producto y variantes              (admin)
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import admin_only, current_user
from ..models import Category, Product, Variant
from ..schemas import CategoryIn, ProductIn, VariantIn
from ..services.serialize import product_out
from ..services.stock import move

router = APIRouter(tags=["products"])


def _load(db: Session, pid: int) -> Product:
    """Carga un producto con sus variantes y categoría, o responde 404."""
    product = (
        db.query(Product)
        .options(selectinload(Product.variants), selectinload(Product.category))
        .filter(Product.id == pid)
        .first()
    )
    if not product:
        raise HTTPException(404, "Producto no encontrado")
    return product


def _apply_variants(db: Session, product: Product, variantes: list[VariantIn], user):
    """Crea o actualiza las variantes de un producto.

    - Variante con id existente  → se actualizan color, tono e imagen (el stock NO se toca acá).
    - Variante sin id            → se crea; si trae stock_inicial, se registra como movimiento.
    - Si no se envía ninguna y el producto no tiene, se crea la variante "Único".
    """
    actuales = {v.id: v for v in product.variants}
    for vi in variantes or ([] if actuales else [VariantIn()]):
        if vi.id and vi.id in actuales:
            variante = actuales[vi.id]
            variante.color, variante.codigo_color, variante.imagen_url = vi.color, vi.codigo_color, vi.imagen_url
        else:
            variante = Variant(
                product=product, color=vi.color, codigo_color=vi.codigo_color,
                imagen_url=vi.imagen_url, stock_actual=Decimal(0),
            )
            db.add(variante)
            db.flush()  # para obtener el id antes de registrar el movimiento
            if vi.stock_inicial > 0:
                move(db, variante, "ajuste_entrada", vi.stock_inicial, "Stock inicial", user.id)


# --- Categorías ---------------------------------------------------------------
@router.get("/categories")
def categories(db: Session = Depends(get_db), user=Depends(current_user)):
    return [{"id": c.id, "nombre": c.nombre} for c in db.query(Category).order_by(Category.nombre)]


@router.post("/categories")
def add_category(data: CategoryIn, db: Session = Depends(get_db), user=Depends(admin_only)):
    nombre = data.nombre.strip()
    if db.query(Category).filter(Category.nombre == nombre).first():
        raise HTTPException(400, "Esa categoría ya existe")
    categoria = Category(nombre=nombre)
    db.add(categoria)
    db.commit()
    return {"id": categoria.id, "nombre": categoria.nombre}


# --- Productos ----------------------------------------------------------------
@router.get("/products")
def list_products(
    q: str = "",
    activos: bool = False,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    """Lista productos. `q` busca por nombre, código, categoría o color.

    Cada palabra de `q` debe coincidir con algún campo ("cinta raso" encuentra "Cinta de raso 25mm").
    """
    consulta = db.query(Product).options(selectinload(Product.variants), selectinload(Product.category))

    palabras = q.split()
    if palabras:
        condiciones = [
            or_(
                Product.nombre.ilike(f"%{w}%"),
                Product.codigo.ilike(f"%{w}%"),
                Category.nombre.ilike(f"%{w}%"),
                Variant.color.ilike(f"%{w}%"),
            )
            for w in palabras
        ]
        ids = (
            select(Product.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .outerjoin(Variant, Variant.product_id == Product.id)
            .where(*condiciones)
        )
        consulta = consulta.filter(Product.id.in_(ids))

    # El empleado solo ve productos activos
    if activos or user.rol != "admin":
        consulta = consulta.filter(Product.activo.is_(True))

    return [product_out(p, user.rol == "admin") for p in consulta.order_by(Product.nombre).limit(limit)]


@router.get("/products/{pid}")
def get_product(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    return product_out(_load(db, pid), user.rol == "admin")


@router.post("/products")
def create_product(data: ProductIn, db: Session = Depends(get_db), user=Depends(admin_only)):
    if db.query(Product).filter(Product.codigo == data.codigo).first():
        raise HTTPException(400, "Ya existe un producto con ese código")
    product = Product(**data.model_dump(exclude={"variants"}))
    db.add(product)
    db.flush()
    _apply_variants(db, product, data.variants, user)
    db.commit()
    return product_out(_load(db, product.id), admin=True)


@router.put("/products/{pid}")
def update_product(pid: int, data: ProductIn, db: Session = Depends(get_db), user=Depends(admin_only)):
    product = _load(db, pid)
    if db.query(Product).filter(Product.codigo == data.codigo, Product.id != pid).first():
        raise HTTPException(400, "Ya existe un producto con ese código")
    for campo, valor in data.model_dump(exclude={"variants"}).items():
        setattr(product, campo, valor)
    _apply_variants(db, product, data.variants, user)
    db.commit()
    return product_out(_load(db, pid), admin=True)
