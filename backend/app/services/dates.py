"""Utilidades de fechas en la zona horaria del negocio (settings.TIMEZONE).

Las fechas se guardan en la base con zona horaria; acá se calculan los rangos de
"hoy", "este mes" o "este año" respetando la hora local de Argentina.
Todos los rangos son [inicio, fin): incluyen el inicio y excluyen el fin.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from ..config import settings

# Zona horaria del negocio. Si el servidor no tiene la base de zonas horarias (paquete tzdata)
# o el nombre está mal escrito, se usa UTC-3 fijo: Argentina no cambia la hora en verano,
# así que el resultado es el mismo y la API no se cae al arrancar.
try:
    TZ = ZoneInfo(settings.TIMEZONE)
except Exception:
    TZ = timezone(timedelta(hours=-3), "ART")


def now() -> datetime:
    """Fecha y hora actual en la zona del negocio."""
    return datetime.now(TZ)


def day_range(d: date):
    """Rango de un día completo."""
    inicio = datetime.combine(d, time.min, TZ)
    return inicio, inicio + timedelta(days=1)


def month_range(y: int, m: int):
    """Rango de un mes completo (maneja el salto de diciembre a enero)."""
    return datetime(y, m, 1, tzinfo=TZ), datetime(y + (m == 12), (m % 12) + 1, 1, tzinfo=TZ)


def year_range(y: int):
    """Rango de un año completo."""
    return datetime(y, 1, 1, tzinfo=TZ), datetime(y + 1, 1, 1, tzinfo=TZ)


def local_iso(dt: datetime | None):
    """Convierte una fecha a texto ISO en hora local (ej. 2026-11-06T14:30-03:00)."""
    return dt.astimezone(TZ).isoformat(timespec="minutes") if dt else None
