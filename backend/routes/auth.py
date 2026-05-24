import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.email import send_verification_email
from backend.models.email_verification import EmailVerification
from backend.models.user import User
from backend.schemas.user import Token, UserLogin, UserOut, UserRegister, VerifyCode
from backend.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

USER_CAP = 100
CODE_TTL_MINUTES = 15
RESEND_COOLDOWN_SECONDS = 60


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    # Check against verified users
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Cooldown: prevent spamming the same email
    existing = db.query(EmailVerification).filter(EmailVerification.email == payload.email).first()
    if existing:
        seconds_since = (
            datetime.now(timezone.utc) - existing.created_at.replace(tzinfo=timezone.utc)
        ).total_seconds()
        if seconds_since < RESEND_COOLDOWN_SECONDS:
            raise HTTPException(status_code=429, detail="Please wait before requesting a new code")
        db.delete(existing)
        db.commit()

    code = _generate_code()
    verification = EmailVerification(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES),
    )
    db.add(verification)
    db.commit()

    try:
        send_verification_email(payload.email, code)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please try again.")

    return {"detail": "Verification code sent. Please check your email."}


@router.post("/verify", response_model=Token, status_code=status.HTTP_201_CREATED)
def verify(payload: VerifyCode, db: Session = Depends(get_db)):
    verification = db.query(EmailVerification).filter(EmailVerification.email == payload.email).first()

    if not verification:
        raise HTTPException(status_code=400, detail="No pending verification for this email")

    if datetime.now(timezone.utc) > verification.expires_at.replace(tzinfo=timezone.utc):
        db.delete(verification)
        db.commit()
        raise HTTPException(status_code=400, detail="Verification code has expired")

    if payload.code != verification.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if db.query(User).count() >= USER_CAP:
        raise HTTPException(status_code=403, detail="Registration is currently closed (user limit reached)")

    user = User(
        username=verification.username,
        email=verification.email,
        hashed_password=verification.hashed_password,
        is_verified=True,
    )
    db.add(user)
    db.delete(verification)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/refresh", response_model=Token)
def refresh(current_user: User = Depends(get_current_user)):
    token = create_access_token({"sub": str(current_user.id), "username": current_user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account is not verified")

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {"access_token": token, "token_type": "bearer"}
