"""Violations and Incidents routers."""
import math, uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_safety_officer, require_admin
from app.database.database import get_db
from app.database.models import Violation, Incident, User
from app.schemas.schemas import (
    IncidentCreate, IncidentUpdate, IncidentResponse, PaginatedIncidents,
    ViolationResponse, PaginatedViolations,
)

# ── Violations ─────────────────────────────────────────────────────────────
violation_router = APIRouter(prefix="/api/violations", tags=["Violations"])

@violation_router.get("/", response_model=PaginatedViolations)
async def list_violations(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    camera_id: uuid.UUID | None = None,
    incident_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    filters = []
    if camera_id:
        filters.append(Violation.camera_id == camera_id)
    if incident_id:
        # Incident stores violation_id — fetch that violation's id
        inc_r = await db.execute(select(Incident).where(Incident.id == incident_id))
        inc = inc_r.scalars().first()
        if inc and inc.violation_id:
            filters.append(Violation.id == inc.violation_id)
        else:
            # No violation linked — return empty result
            return PaginatedViolations(items=[], total=0, page=page, size=size, pages=1)
    q = select(Violation).where(and_(*filters)) if filters else select(Violation)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(Violation.detected_at.desc()).offset((page-1)*size).limit(size))).scalars().all()
    return PaginatedViolations(items=items, total=total, page=page, size=size, pages=math.ceil(total/size) if total else 1)

@violation_router.get("/{violation_id}", response_model=ViolationResponse)
async def get_violation(violation_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                        _: User = Depends(get_current_user)):
    r = await db.execute(select(Violation).where(Violation.id == violation_id))
    v = r.scalars().first()
    if not v:
        raise HTTPException(404, detail="Violation not found")
    return v

@violation_router.delete("/{violation_id}", status_code=204)
async def delete_violation(violation_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                           _: User = Depends(require_admin)):
    r = await db.execute(select(Violation).where(Violation.id == violation_id))
    v = r.scalars().first()
    if not v:
        raise HTTPException(404, detail="Violation not found")
    await db.delete(v)


# ── Incidents ──────────────────────────────────────────────────────────────
incident_router = APIRouter(prefix="/api/incidents", tags=["Incidents"])

@incident_router.get("/", response_model=PaginatedIncidents)
async def list_incidents(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    status: str | None = None, severity: str | None = None,
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    filters = []
    if status:
        filters.append(Incident.status == status.upper())
    if severity:
        filters.append(Incident.severity == severity.upper())
    q = select(Incident).where(and_(*filters)) if filters else select(Incident)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(Incident.created_at.desc()).offset((page-1)*size).limit(size))).scalars().all()
    return PaginatedIncidents(items=items, total=total, page=page, size=size, pages=math.ceil(total/size) if total else 1)

@incident_router.post("/", response_model=IncidentResponse, status_code=201)
async def create_incident(payload: IncidentCreate, db: AsyncSession = Depends(get_db),
                          _: User = Depends(require_safety_officer)):
    inc = Incident(**payload.model_dump())
    db.add(inc)
    await db.flush()
    await db.refresh(inc)
    return inc

@incident_router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                       _: User = Depends(get_current_user)):
    r = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = r.scalars().first()
    if not inc:
        raise HTTPException(404, detail="Incident not found")
    return inc

@incident_router.put("/{incident_id}", response_model=IncidentResponse)
async def update_incident(incident_id: uuid.UUID, payload: IncidentUpdate,
                          db: AsyncSession = Depends(get_db), _: User = Depends(require_safety_officer)):
    r = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = r.scalars().first()
    if not inc:
        raise HTTPException(404, detail="Incident not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("status") == "RESOLVED" and inc.status != "RESOLVED":
        data["resolved_at"] = datetime.now(timezone.utc)
    for k, v in data.items():
        setattr(inc, k, v)
    await db.flush()
    await db.refresh(inc)
    return inc

@incident_router.patch("/{incident_id}/assign", response_model=IncidentResponse)
async def assign_incident(incident_id: uuid.UUID, assigned_to: uuid.UUID | None,
                          db: AsyncSession = Depends(get_db), _: User = Depends(require_safety_officer)):
    r = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = r.scalars().first()
    if not inc:
        raise HTTPException(404, detail="Incident not found")
    inc.assigned_to = assigned_to
    if inc.status == "OPEN" and assigned_to:
        inc.status = "ASSIGNED"
    await db.flush()
    await db.refresh(inc)
    return inc

@incident_router.delete("/{incident_id}", status_code=204)
async def delete_incident(incident_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                          _: User = Depends(require_admin)):
    r = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = r.scalars().first()
    if not inc:
        raise HTTPException(404, detail="Incident not found")
    await db.delete(inc)
