"""
SentinelAI Demo Data Seed Script
=================================
Creates sample users, locations, cameras, workers, and incidents
for demonstration purposes.

Usage:
    cd backend
    python -m sample_data.seed
OR
    python seed.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
from app.core.security import get_password_hash
from app.database.models import User, Worker, Location, Camera

engine = create_async_engine(settings.DATABASE_URL, echo=False)
Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

LOCATIONS = [
    {"name": "Production Floor", "description": "Main manufacturing area"},
    {"name": "Warehouse", "description": "Storage and logistics area"},
    {"name": "Loading Zone", "description": "Truck loading and unloading"},
    {"name": "Assembly Area", "description": "Component assembly line"},
    {"name": "Chemical Storage", "description": "Hazardous materials storage"},
]

CAMERAS = [
    {"camera_code": "CAM-01", "name": "Production Floor - Zone A", "source_type": "WEBCAM", "status": "ONLINE"},
    {"camera_code": "CAM-02", "name": "Production Floor - Zone B", "source_type": "WEBCAM", "status": "OFFLINE"},
    {"camera_code": "CAM-03", "name": "Warehouse Entry", "source_type": "RTSP", "source_url": "rtsp://demo.example.com/cam3", "status": "OFFLINE"},
    {"camera_code": "CAM-04", "name": "Loading Dock", "source_type": "RTSP", "source_url": "rtsp://demo.example.com/cam4", "status": "OFFLINE"},
    {"camera_code": "CAM-05", "name": "Assembly Line", "source_type": "WEBCAM", "status": "ONLINE"},
]

WORKERS = [
    {"worker_code": "WRK-001", "name": "Rahul Sharma", "department": "Production"},
    {"worker_code": "WRK-002", "name": "Priya Patel", "department": "Warehouse"},
    {"worker_code": "WRK-003", "name": "Amit Kumar", "department": "Logistics"},
    {"worker_code": "WRK-004", "name": "Sneha Reddy", "department": "Assembly"},
    {"worker_code": "WRK-005", "name": "Vijay Singh", "department": "Production"},
    {"worker_code": "WRK-006", "name": "Lakshmi Nair", "department": "Quality"},
]

EXTRA_USERS = [
    {"name": "Safety Officer 1", "email": "officer@sentinelai.com", "role": "SAFETY_OFFICER", "password": "Officer@12345"},
    {"name": "Supervisor 1", "email": "supervisor@sentinelai.com", "role": "SUPERVISOR", "password": "Super@12345"},
]


async def seed():
    from app.database.database import init_db
    await init_db()

    async with Session() as session:
        from sqlalchemy import select

        # Extra users
        for u in EXTRA_USERS:
            r = await session.execute(select(User).where(User.email == u["email"]))
            if not r.scalars().first():
                session.add(User(name=u["name"], email=u["email"],
                                 password_hash=get_password_hash(u["password"]), role=u["role"]))

        # Locations
        loc_map = {}
        for ld in LOCATIONS:
            r = await session.execute(select(Location).where(Location.name == ld["name"]))
            loc = r.scalars().first()
            if not loc:
                loc = Location(**ld)
                session.add(loc)
                await session.flush()
            loc_map[ld["name"]] = loc

        # Cameras
        cam_loc_map = {
            "CAM-01": "Production Floor", "CAM-02": "Production Floor",
            "CAM-03": "Warehouse", "CAM-04": "Loading Zone", "CAM-05": "Assembly Area",
        }
        for cd in CAMERAS:
            r = await session.execute(select(Camera).where(Camera.camera_code == cd["camera_code"]))
            if not r.scalars().first():
                loc = loc_map.get(cam_loc_map.get(cd["camera_code"]))
                cam = Camera(**{k: v for k, v in cd.items()}, location_id=loc.id if loc else None)
                session.add(cam)

        # Workers
        for wd in WORKERS:
            r = await session.execute(select(Worker).where(Worker.worker_code == wd["worker_code"]))
            if not r.scalars().first():
                session.add(Worker(**wd))

        await session.commit()
        print("✅ Demo data seeded successfully!")
        print("\nCredentials:")
        print("  Admin:          admin@sentinelai.com / Admin@12345")
        print("  Safety Officer: officer@sentinelai.com / Officer@12345")
        print("  Supervisor:     supervisor@sentinelai.com / Super@12345")


if __name__ == "__main__":
    asyncio.run(seed())
