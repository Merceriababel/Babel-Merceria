"""Punto de entrada de Vercel: expone el backend FastAPI bajo /api.

El frontend (carpeta public/) se sirve como sitio estático y llama a /api/...
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from fastapi import FastAPI  # noqa: E402

from app.main import app as backend  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", backend)  # Vercel conserva el prefijo /api
app.mount("/", backend)     # por si el prefijo llega recortado
