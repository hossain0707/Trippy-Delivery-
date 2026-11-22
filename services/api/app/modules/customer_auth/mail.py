import smtplib
import ssl
from email.message import EmailMessage
from app.core.config import settings


def email_ready():
    c = settings()
    return bool(c.smtp_host and c.smtp_username and c.smtp_password and c.smtp_from)


def send_link(email: str, token: str, purpose: str):
    c = settings()
    page = "verify-email" if purpose == "verify" else "reset-password"
    url = c.customer_app_origin.rstrip("/") + "/" + page + "#token=" + token
    msg = EmailMessage()
    msg["From"] = c.smtp_from
    msg["To"] = email
    msg["Subject"] = (
        "Verify your TRIPPY Delivery email"
        if purpose == "verify"
        else "Reset your TRIPPY Delivery password"
    )
    msg.set_content(
        f"Open this link to {'verify your email' if purpose == 'verify' else 'reset your password'}:\n\n{url}\n\nThis link expires in 30 minutes and works once. If you did not request it, ignore this email.\nTRIPPY Delivery"
    )
    # Tokens and passwords are never logged. Always require authenticated, encrypted SMTP.
    if c.smtp_port == 465:
        with smtplib.SMTP_SSL(
            c.smtp_host, c.smtp_port, timeout=15, context=ssl.create_default_context()
        ) as smtp:
            smtp.login(c.smtp_username, c.smtp_password.get_secret_value())
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(c.smtp_host, c.smtp_port, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(c.smtp_username, c.smtp_password.get_secret_value())
            smtp.send_message(msg)
