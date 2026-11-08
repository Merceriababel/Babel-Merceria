"""Punto de entrada de la API (FastAPI).

Local:   uvicorn app.main:app --reload     →  http://localhost:8000/docs
Vercel:  lo carga api/index.py (en la raíz del proyecto) y lo expone bajo /api.

Para agregar un módulo nuevo: crear app/routers/<modulo>.py con un `router` y sumarlo a la lista de abajo.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, products, purchases, reports, sales, stock, suppliers

app = FastAPI(title="Babel Mercería API")

# CORS: qué sitios web pueden llamar a la API desde el navegador.
# En Vercel el sitio y la API comparten dominio, así que solo importa en desarrollo local.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de módulos (cada uno define sus propias rutas)
for modulo in (auth, products, suppliers, stock, purchases, sales, reports):
    app.include_router(modulo.router)


@app.get("/")
def health():
    """Chequeo rápido para saber si la API está viva."""
    return {"ok": True, "app": "Babel Mercería API", "docs": "/docs"}
