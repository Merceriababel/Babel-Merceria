"""Autenticación: login, sesión actual, recuperar y cambiar contraseña.

Rutas:
  POST /auth/login            correo + contraseña → token de sesión
  GET  /auth/me               datos del usuario logueado
  POST /auth/forgot           envía el enlace de recuperación por correo
  POST /auth/reset            fija una contraseña nueva con el token del enlace
  POST /auth/change-password  cambio de contraseña estando logueado
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import User
from ..schemas import ChangePassIn, ForgotIn, LoginIn, ResetIn
from ..security import check_password, hash_password, make_token, read_token
from ..services.mail import send_mail

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(u: User):
    """Datos públicos del usuario (nunca incluye el hash de la contraseña)."""
    return {"id": u.id, "nombre": u.nombre, "email": u.email, "rol": u.rol}


def _by_email(db: Session, email: str):
    """Busca un usuario por correo sin distinguir mayúsculas."""
    return db.query(User).filter(func.lower(User.email) == email.lower().strip()).first()


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = _by_email(db, data.email)
    # Mismo mensaje para "no existe" y "clave incorrecta": no revela qué correos están registrados
    if not user or not user.activo or not check_password(data.password, user.password_hash):
        raise HTTPException(401, "Correo o contraseña incorrectos")
    return {"token": make_token(user.id), "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.post("/forgot")
def forgot(data: ForgotIn, db: Session = Depends(get_db)):
    user = _by_email(db, data.email)
    if user and user.activo:
        # El enlace usa "#/" porque el frontend navega con rutas por hash
        token = make_token(user.id, minutes=30, kind="reset")
        link = f"{settings.FRONTEND_URL.rstrip('/')}/#/restablecer?token={token}"
        send_mail(
            user.email,
            "Recuperar contraseña - Babel Mercería",
            f"Hola {user.nombre},\n\nEntrá a este enlace para elegir una contraseña nueva "
            f"(vence en 30 minutos):\n{link}\n",
        )
    # Siempre responde OK para no revelar qué correos existen
    return {"ok": True}


@router.post("/reset")
def reset(data: ResetIn, db: Session = Depends(get_db)):
    try:
        uid = read_token(data.token, kind="reset")
    except Exception:
        raise HTTPException(400, "El enlace es inválido o venció")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(400, "El enlace es inválido o venció")
    user.password_hash = hash_password(data.password)
    db.commit()
    return {"ok": True}


@router.post("/change-password")
def change_password(data: ChangePassIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not check_password(data.actual, user.password_hash):
        raise HTTPException(400, "La contraseña actual no es correcta")
    user.password_hash = hash_password(data.nueva)
    db.commit()
    return {"ok": True}
