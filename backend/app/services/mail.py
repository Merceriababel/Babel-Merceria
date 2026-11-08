"""Envío de correos por Gmail (SMTP).

Requiere SMTP_USER y SMTP_PASSWORD (contraseña de aplicación de Gmail).
Si falta la configuración o el envío falla, NO se rompe la operación que lo disparó:
simplemente no sale el correo.
"""
import smtplib
import ssl
from email.message import EmailMessage

from ..config import settings


def send_mail(to: str, subject: str, body: str) -> bool:
    """Envía un correo de texto plano. Devuelve True si salió, False si no."""
    if not (settings.SMTP_USER and settings.SMTP_PASSWORD and to):
        return False  # correo no configurado

    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.SMTP_USER, to, subject
    msg.set_content(body)

    try:
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, context=ssl.create_default_context(), timeout=10
        ) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:
        return False
