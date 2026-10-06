"""Cameras, Workers, Locations routers."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_current_user, require_safety_officer, require_admin
from app.database.database import get_db
from app.database.models import Camera, Worker, Location, User
from app.schemas.schemas import (
    CameraCreate, CameraUpdate, CameraResponse,
    WorkerCreate, WorkerUpdate, WorkerResponse,
    LocationCreate, LocationResponse,
)

# ── Cameras ────────────────────────────────────────────────────────────────
camera_router = APIRouter(prefix="/api/cameras", tags=["Cameras"])

@camera_router.get("/", response_model=list[CameraResponse])
async def list_cameras(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    r = await db.execute(select(Camera).order_by(Camera.created_at.desc()))
    return r.scalars().all()

@camera_router.post("/", response_model=CameraResponse, status_code=201)
async def create_camera(payload: CameraCreate, db: AsyncSession = Depends(get_db),
                        _: User = Depends(require_safety_officer)):
    r = await db.execute(select(Camera).where(Camera.camera_code == payload.camera_code))
    if r.scalars().first():
        raise HTTPException(409, detail="Camera code already exists")
    cam = Camera(**payload.model_dump())
    db.add(cam)
    await db.flush()
    await db.refresh(cam)
    return cam

@camera_router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                     _: User = Depends(get_current_user)):
    r = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = r.scalars().first()
    if not cam:
        raise HTTPException(404, detail="Camera not found")
    return cam

@camera_router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(camera_id: uuid.UUID, payload: CameraUpdate,
                        db: AsyncSession = Depends(get_db), _: User = Depends(require_safety_officer)):
    r = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = r.scalars().first()
    if not cam:
        raise HTTPException(404, detail="Camera not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cam, k, v)
    await db.flush()
    await db.refresh(cam)
    return cam

@camera_router.delete("/{camera_id}", status_code=204)
async def delete_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                        _: User = Depends(require_admin)):
    r = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = r.scalars().first()
    if not cam:
        raise HTTPException(404, detail="Camera not found")
    await db.delete(cam)


# ── Workers ────────────────────────────────────────────────────────────────
worker_router = APIRouter(prefix="/api/workers", tags=["Workers"])

@worker_router.get("/", response_model=list[WorkerResponse])
async def list_workers(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    r = await db.execute(select(Worker).order_by(Worker.created_at.desc()))
    return r.scalars().all()

@worker_router.post("/", response_model=WorkerResponse, status_code=201)
async def create_worker(payload: WorkerCreate, db: AsyncSession = Depends(get_db),
                        _: User = Depends(require_safety_officer)):
    worker = Worker(**payload.model_dump())
    db.add(worker)
    await db.flush()
    await db.refresh(worker)
    return worker

@worker_router.put("/{worker_id}", response_model=WorkerResponse)
async def update_worker(worker_id: uuid.UUID, payload: WorkerUpdate,
                        db: AsyncSession = Depends(get_db), _: User = Depends(require_safety_officer)):
    r = await db.execute(select(Worker).where(Worker.id == worker_id))
    w = r.scalars().first()
    if not w:
        raise HTTPException(404, detail="Worker not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(w, k, v)
    await db.flush()
    await db.refresh(w)
    return w

@worker_router.delete("/{worker_id}", status_code=204)
async def delete_worker(worker_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                        _: User = Depends(require_admin)):
    r = await db.execute(select(Worker).where(Worker.id == worker_id))
    w = r.scalars().first()
    if not w:
        raise HTTPException(404, detail="Worker not found")
    await db.delete(w)


# ── Locations ──────────────────────────────────────────────────────────────
location_router = APIRouter(prefix="/api/locations", tags=["Locations"])

@location_router.get("/", response_model=list[LocationResponse])
async def list_locations(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    r = await db.execute(select(Location).order_by(Location.name))
    return r.scalars().all()

@location_router.post("/", response_model=LocationResponse, status_code=201)
async def create_location(payload: LocationCreate, db: AsyncSession = Depends(get_db),
                          _: User = Depends(require_safety_officer)):
    loc = Location(**payload.model_dump())
    db.add(loc)
    await db.flush()
    await db.refresh(loc)
    return loc

@location_router.delete("/{location_id}", status_code=204)
async def delete_location(location_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                          _: User = Depends(require_admin)):
    r = await db.execute(select(Location).where(Location.id == location_id))
    loc = r.scalars().first()
    if not loc:
        raise HTTPException(404, detail="Location not found")
    await db.delete(loc)
