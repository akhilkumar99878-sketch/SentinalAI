"""
Async SQLAlchemy engine, session factory, Base, get_db dependency, and init_db.
"""
import logging
import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy import select

from app.core.config import settings

logger = logging.getLogger(__name__)

async_engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables and seed the first admin user."""
    from app.database import models  # noqa: F401
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        from app.database.models import User
        from app.core.security import get_password_hash
        result = await session.execute(select(User).where(User.role == "ADMIN"))
        if not result.scalars().first():
            admin = User(
                name=settings.FIRST_ADMIN_NAME,
                email=settings.FIRST_ADMIN_EMAIL,
                password_hash=get_password_hash(settings.FIRST_ADMIN_PASSWORD),
                role="ADMIN",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            logger.info("✅ Admin user seeded: %s", settings.FIRST_ADMIN_EMAIL)
