"""Users router — CRUD, admin-only for create/delete."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.dependencies import get_current_user, require_admin
from app.core.security import get_password_hash
from app.database.database import get_db
from app.database.models import User
from app.schemas.schemas import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(skip: int = 0, limit: int = 50,
                     db: AsyncSession = Depends(get_db),
                     _: User = Depends(require_admin)):
    r = await db.execute(select(User).order_by(User.created_at.desc()).offset(skip).limit(limit))
    return r.scalars().all()


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db),
                      _: User = Depends(require_admin)):
    r = await db.execute(select(User).where(User.email == payload.email))
    if r.scalars().first():
        raise HTTPException(409, detail="Email already registered")
    user = User(name=payload.name, email=payload.email,
                password_hash=get_password_hash(payload.password), role=payload.role)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                   _: User = Depends(require_admin)):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: uuid.UUID, payload: UserUpdate,
                      db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        user.password_hash = get_password_hash(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                      current: User = Depends(require_admin)):
    if user_id == current.id:
        raise HTTPException(400, detail="Cannot delete your own account")
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, detail="User not found")
    user.is_active = False
    await db.flush()
