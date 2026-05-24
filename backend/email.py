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
