"""Crea los DOS usuarios del sistema (admin y empleado) y las categorías iniciales.

Uso (desde la carpeta backend, con el .env cargado):

    Mac/Linux:
      ADMIN_PASSWORD=xxxx EMPLEADO_EMAIL=empleado@correo.com EMPLEADO_PASSWORD=yyyy python3 scripts/seed.py

    Windows (PowerShell): definir antes cada variable con  $env:NOMBRE="valor"  y luego  python scripts/seed.py

Variables:
    ADMIN_EMAIL        (opcional) correo del admin. Por defecto: Marcossosa1999@outlook.com.ar
    ADMIN_PASSWORD     (obligatoria) contraseña del admin
    EMPLEADO_EMAIL     (opcional) correo del empleado. Por defecto: empleado@babel.com
    EMPLEADO_PASSWORD  (obligatoria) contraseña del empleado

Es seguro correrlo más de una vez: no duplica usuarios ni categorías.
"""
import os
import sys

# Permite importar el paquete `app` aunque el script se ejecute desde otra carpeta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal  # noqa: E402
from app.models import Category, User  # noqa: E402
from app.security import hash_password  # noqa: E402

# (rol, nombre visible, correo, contraseña)
USUARIOS = [
    ("admin", "Administrador", os.getenv("ADMIN_EMAIL", "Marcossosa1999@outlook.com.ar"), os.getenv("ADMIN_PASSWORD")),
    ("empleado", "Empleado", os.getenv("EMPLEADO_EMAIL", "empleado@babel.com"), os.getenv("EMPLEADO_PASSWORD")),
]
CATEGORIAS = ["Telas", "Lanas", "Hilos", "Cintas", "Botones", "Agujas y accesorios", "Otros"]

db = SessionLocal()

# Usuarios: uno por rol (la base también lo exige con un índice único)
for rol, nombre, email, password in USUARIOS:
    if not password:
        sys.exit(f"Falta la contraseña: definí {rol.upper()}_PASSWORD")
    existente = db.query(User).filter(User.rol == rol).first()
    if existente:
        print(f"Ya existe el usuario {rol}: {existente.email}")
        continue
    db.add(User(nombre=nombre, email=email, password_hash=hash_password(password), rol=rol, activo=True))
    print(f"Creado {rol}: {email}")

# Categorías iniciales
for nombre in CATEGORIAS:
    if not db.query(Category).filter(Category.nombre == nombre).first():
        db.add(Category(nombre=nombre))

db.commit()
print("Listo.")
