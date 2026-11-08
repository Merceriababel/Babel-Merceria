"""Entrada del backend para Vercel (Services).

Vercel envía a este servicio las rutas que empiezan con /api (ver vercel.json),
y la API de la aplicación (app/main.py) define sus rutas sin ese prefijo.
Por eso se monta la API completa bajo /api.

Local: seguí usando  uvicorn app.main:app --reload  (sin prefijo /api).
"""
from fastapi import FastAPI

from app.main import app as api_app

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api_app)  # Vercel conserva el prefijo /api
app.mount("/", api_app)     # por si el prefijo llegara recortado 
