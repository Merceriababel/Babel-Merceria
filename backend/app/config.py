"""Configuración de la aplicación.

Todas las opciones se leen de variables de entorno:
  - En Vercel:  Settings → Environment Variables.
  - En tu compu: archivo backend/.env (copiá .env.example).

Para agregar una opción nueva: declarala en la clase Settings con su valor por defecto
y usala desde cualquier archivo con `from .config import settings`.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Lee el archivo .env si existe e ignora variables que no estén declaradas acá.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Base de datos (PostgreSQL en Neon o Supabase) ---
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/babel"

    # --- Seguridad ---
    SECRET_KEY: str = "cambiar-esta-clave"  # firma los tokens de sesión: debe ser larga y secreta
    TOKEN_MINUTES: int = 720                # duración de la sesión (12 horas)

    # --- Web ---
    CORS_ORIGINS: str = "http://localhost:5173"  # sitios autorizados a llamar la API, separados por coma
    FRONTEND_URL: str = "http://localhost:5173"  # URL pública del sitio (se usa en el mail de recuperación)

    # --- Correo (Gmail con "contraseña de aplicación") ---
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""       # cuenta que envía los correos
    SMTP_PASSWORD: str = ""   # contraseña de aplicación de esa cuenta
    ALERT_EMAIL: str = ""     # quién recibe los avisos de stock bajo

    # --- Zona horaria del negocio (define qué es "hoy" en reportes y ventas del día) ---
    TZ: str = "America/Argentina/Cordoba"


# Instancia única que se importa desde el resto del código
settings = Settings()
