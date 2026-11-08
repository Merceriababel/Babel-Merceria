"""Dependencias de FastAPI para proteger rutas según el usuario.

Uso en un router:
    def mi_ruta(user = Depends(current_user)): ...   # cualquier usuario logueado
    def mi_ruta(user = Depends(admin_only)): ...     # solo el administrador
"""
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import User
from .security import read_token

# Extrae el token del encabezado "Authorization: Bearer <token>"
oauth = OAuth2PasswordBearer(tokenUrl="auth/login")


def current_user(token: str = Depends(oauth), db: Session = Depends(get_db)) -> User:
    """Devuelve el usuario dueño del token, o responde 401 si es inválido, vencido o está inactivo."""
    try:
        uid = read_token(token)
    except Exception:
        raise HTTPException(401, "Sesión inválida o vencida")
    user = db.get(User, uid)
    if not user or not user.activo:
        raise HTTPException(401, "Usuario inactivo")
    return user


def admin_only(user: User = Depends(current_user)) -> User:
    """Igual que current_user pero responde 403 si el usuario no es administrador."""
    if user.rol != "admin":
        raise HTTPException(403, "Solo el administrador puede hacer esto")
    return user
