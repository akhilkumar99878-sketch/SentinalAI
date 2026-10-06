"""Auth router: login, me, logout."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import User, AuditLog
from app.schemas.schemas import Token, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.last_login = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=user.id, action="LOGIN", resource="auth",
                    ip_address=request.client.host if request.client else None))
    await db.flush()
    return Token(access_token=create_access_token({"sub": user.email}))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    db.add(AuditLog(user_id=current_user.id, action="LOGOUT", resource="auth"))
    await db.flush()
    return {"message": "Logged out successfully"}
