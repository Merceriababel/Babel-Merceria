"""Conexión a la base de datos con SQLAlchemy.

Expone:
  - engine / SessionLocal: conexión y fábrica de sesiones.
  - Base: clase madre de todos los modelos (ver models.py).
  - get_db: dependencia de FastAPI que entrega una sesión por pedido y la cierra al terminar.
  - url: cadena de conexión ya normalizada (la usa Alembic).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings

# Neon/Supabase entregan "postgresql://..." pero SQLAlchemy necesita indicar el driver (psycopg2).
url = settings.DATABASE_URL
for prefix in ("postgres://", "postgresql://"):
    if url.startswith(prefix):
        url = "postgresql+psycopg2://" + url[len(prefix):]

# NullPool: en Vercel (serverless) cada ejecución abre y cierra su propia conexión,
# por eso se recomienda usar la cadena "pooled" de Neon/Supabase.
engine = create_engine(url, poolclass=NullPool, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    """Clase madre de todos los modelos (tablas)."""


def get_db():
    """Entrega una sesión de base de datos por pedido y la cierra siempre al terminar.

    Si ocurre un error antes del commit, la sesión se cierra y la transacción se revierte sola.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
