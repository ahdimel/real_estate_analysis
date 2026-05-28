import os
import resend
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_ADDRESS = "noreply@reianalyzer.online"
APP_NAME = "REI Analyzer"


def send_verification_email(to_email: str, code: str) -> None:
    resend.Emails.send({
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": f"Your {APP_NAME} verification code",
        "text": (
            f"Your verification code is: {code}\n\n"
            f"This code expires in 15 minutes.\n\n"
            f"If you did not request this, you can safely ignore this email."
        ),
    })


def send_password_reset_email(to_email: str, reset_url: str, username: str) -> None:
    resend.Emails.send({
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": f"{APP_NAME} — password reset",
        "text": (
            f"You requested a password reset for your {APP_NAME} account.\n\n"
            f"Your username is: {username}\n\n"
            f"Click the link below to set a new password:\n{reset_url}\n\n"
            f"This link expires in 1 hour.\n\n"
            f"If you did not request this, you can safely ignore this email. "
            f"Your password has not been changed."
        ),
    })
