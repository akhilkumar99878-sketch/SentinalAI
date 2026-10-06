"""Analytics and Reports routers."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone, date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import User, Camera, Violation, Incident, Worker
from app.schemas.schemas import (
    OverviewStats, DailyTrend, PPEBreakdownItem,
    CameraStat, AIStatus,
)

analytics_router = APIRouter(prefix="/api/analytics", tags=["Analytics"])
reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])


@analytics_router.get("/overview", response_model=OverviewStats)
async def overview(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    from app.database.models import DetectionResult
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    thirty_ago = datetime.now(timezone.utc) - timedelta(days=30)

    # 1. Worker count from registered workers OR detection results
    total_registered_workers = (await db.execute(select(func.count()).select_from(Worker))).scalar_one()
    
    # 2. Camera counts
    total_cameras = (await db.execute(select(func.count()).select_from(Camera))).scalar_one()
    active_cameras_count = (await db.execute(select(func.count()).select_from(Camera).where(Camera.status == "ONLINE"))).scalar_one()

    # 3. Detection results in last 30 days
    total_detections_30d = (await db.execute(select(func.count()).select_from(DetectionResult).where(DetectionResult.frame_timestamp >= thirty_ago))).scalar_one()
    total_detections_today = (await db.execute(select(func.count()).select_from(DetectionResult).where(DetectionResult.frame_timestamp >= today))).scalar_one()

    # 4. Violations
    today_violations_count = (await db.execute(select(func.count()).select_from(Violation).where(Violation.detected_at >= today))).scalar_one()
    total_violations_30d = (await db.execute(select(func.count()).select_from(Violation).where(Violation.detected_at >= thirty_ago))).scalar_one()

    # 5. Incidents
    open_incidents_count = (await db.execute(select(func.count()).select_from(Incident).where(Incident.status == "OPEN"))).scalar_one()
    total_incidents_count = (await db.execute(select(func.count()).select_from(Incident))).scalar_one()
    resolved_incidents_count = (await db.execute(select(func.count()).select_from(Incident).where(Incident.status == "RESOLVED"))).scalar_one()

    # Determine real data presence
    has_detection_data = (total_detections_30d > 0 or total_violations_30d > 0)
    has_worker_data = (total_registered_workers > 0)
    has_camera_data = (total_cameras > 0)
    has_incident_data = (total_incidents_count > 0)

    # Calculate Workers Monitored
    total_workers_val = None
    if has_worker_data:
        total_workers_val = total_registered_workers
    elif has_detection_data:
        # Sum worker counts detected in records
        det_workers_sum = (await db.execute(select(func.count()).select_from(DetectionResult))).scalar_one()
        total_workers_val = det_workers_sum

    # Calculate Active Cameras
    active_cameras_val = active_cameras_count if has_camera_data else None

    # Calculate Today's Violations (only show 0 if real detections occurred today or violations exist)
    today_violations_val = None
    if total_detections_today > 0 or today_violations_count > 0:
        today_violations_val = today_violations_count
    elif has_detection_data:
        today_violations_val = 0

    # Calculate Real PPE Compliance Rate
    compliance_rate_val = None
    if total_detections_30d > 0:
        compliant_detections = (await db.execute(
            select(func.count()).select_from(DetectionResult)
            .where(DetectionResult.frame_timestamp >= thirty_ago, DetectionResult.compliance_status == "COMPLIANT")
        )).scalar_one()
        compliance_rate_val = round((compliant_detections / total_detections_30d) * 100, 1)
    elif total_violations_30d > 0:
        compliance_rate_val = 0.0

    # Calculate Open Incidents
    open_incidents_val = open_incidents_count if has_incident_data else None

    # Calculate Overall Safety Score ONLY when real compliance or incident data exists
    safety_score_val = None
    formula_val = None
    if compliance_rate_val is not None:
        if total_incidents_count > 0:
            open_rate = (open_incidents_count / total_incidents_count) * 100
            resolution_rate = (resolved_incidents_count / total_incidents_count) * 100
        else:
            open_rate = 0.0
            resolution_rate = 100.0
        calculated_score = round(0.6 * compliance_rate_val + 0.2 * (100 - open_rate) + 0.2 * resolution_rate, 1)
        safety_score_val = min(max(calculated_score, 0.0), 100.0)
        formula_val = "Safety Score = 0.6×Compliance + 0.2×(100−OpenRate) + 0.2×ResolutionRate"

    has_overall_data = (has_detection_data or has_worker_data or has_camera_data or has_incident_data)

    return OverviewStats(
        total_workers=total_workers_val,
        active_cameras=active_cameras_val,
        today_violations=today_violations_val,
        compliance_rate=compliance_rate_val,
        open_incidents=open_incidents_val,
        total_incidents=total_incidents_count if has_incident_data else None,
        safety_score=safety_score_val,
        formula=formula_val,
        has_data=has_overall_data,
        has_detection_data=has_detection_data,
        has_worker_data=has_worker_data,
        has_camera_data=has_camera_data,
        has_incident_data=has_incident_data,
    )


@analytics_router.get("/violations/trends", response_model=list[DailyTrend])
async def violation_trends(days: int = Query(30, ge=7, le=365),
                           db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Check if ANY violations exist
    total_viols = (await db.execute(select(func.count()).select_from(Violation).where(Violation.detected_at >= since))).scalar_one()
    if total_viols == 0:
        return []

    r = await db.execute(
        select(func.date(Violation.detected_at).label("day"), func.count().label("cnt"))
        .where(Violation.detected_at >= since)
        .group_by(func.date(Violation.detected_at))
        .order_by(func.date(Violation.detected_at))
    )
    rows = {str(row.day): row.cnt for row in r.all()}

    result = []
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).date()
        ds = d.isoformat()
        cnt = rows.get(ds, 0)
        result.append(DailyTrend(date=ds, violations=cnt, compliance_rate=round(100 - min(cnt * 5, 100), 1)))
    return result


@analytics_router.get("/ppe/breakdown", response_model=list[PPEBreakdownItem])
async def ppe_breakdown(days: int = Query(30), db: AsyncSession = Depends(get_db),
                        _: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    r = await db.execute(select(Violation.missing_ppe).where(Violation.detected_at >= since))
    counts: dict[str, int] = defaultdict(int)
    total = 0
    for row in r.scalars().all():
        if isinstance(row, list):
            for item in row:
                counts[item] += 1
                total += 1
    return [
        PPEBreakdownItem(ppe_item=k, count=v, percentage=round(v/total*100, 1) if total else 0)
        for k, v in sorted(counts.items(), key=lambda x: -x[1])
    ]


@analytics_router.get("/cameras/stats", response_model=list[CameraStat])
async def camera_stats(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    r = await db.execute(
        select(Camera.id, Camera.name, func.count(Violation.id).label("viol"))
        .outerjoin(Violation, Violation.camera_id == Camera.id)
        .group_by(Camera.id, Camera.name)
        .order_by(func.count(Violation.id).desc())
    )
    rows = r.all()
    return [
        CameraStat(
            camera_id=str(row.id), camera_name=row.name, location=None,
            violations=row.viol,
            compliance_rate=round(max(0, 100 - row.viol * 5), 1),
        )
        for row in rows
    ]


# ── Reports ────────────────────────────────────────────────────────────────
async def _build_report(period: str, since: datetime, db: AsyncSession) -> dict:
    total_viol = (await db.execute(select(func.count()).select_from(Violation).where(Violation.detected_at >= since))).scalar_one()
    total_inc = (await db.execute(select(func.count()).select_from(Incident).where(Incident.created_at >= since))).scalar_one()
    resolved = (await db.execute(select(func.count()).select_from(Incident).where(Incident.status == "RESOLVED", Incident.created_at >= since))).scalar_one()
    open_inc = (await db.execute(select(func.count()).select_from(Incident).where(Incident.status == "OPEN", Incident.created_at >= since))).scalar_one()
    cameras = (await db.execute(select(func.count()).select_from(Camera).where(Camera.status == "ONLINE"))).scalar_one()
    workers = (await db.execute(select(func.count()).select_from(Worker))).scalar_one()
    compliance = max(0, round(100 - min(total_viol * 3, 100), 1))
    return {
        "period": period, "since": since.isoformat(), "generated_at": datetime.now(timezone.utc).isoformat(),
        "workers_monitored": workers, "active_cameras": cameras,
        "total_violations": total_viol, "compliance_rate": compliance,
        "total_incidents": total_inc, "resolved_incidents": resolved, "open_incidents": open_inc,
    }

@reports_router.get("/daily")
async def daily_report(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return await _build_report("DAILY", since, db)

@reports_router.get("/weekly")
async def weekly_report(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _build_report("WEEKLY", datetime.now(timezone.utc) - timedelta(days=7), db)

@reports_router.get("/monthly")
async def monthly_report(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _build_report("MONTHLY", datetime.now(timezone.utc) - timedelta(days=30), db)


# ── Worker Analytics ────────────────────────────────────────────────────────
@analytics_router.get("/workers/stats")
async def worker_stats(days: int = Query(30, ge=7, le=365),
                       db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    r = await db.execute(
        select(Worker.id, Worker.name, Worker.worker_code, Worker.department,
               func.count(Violation.id).label("violations"))
        .outerjoin(Violation, Violation.worker_id == Worker.id)
        .where(Worker.is_active == True)
        .group_by(Worker.id, Worker.name, Worker.worker_code, Worker.department)
        .order_by(func.count(Violation.id).desc())
    )
    rows = r.all()
    return [
        {
            "worker_id": str(row.id),
            "worker_code": row.worker_code,
            "name": row.name,
            "department": row.department or "—",
            "violations": row.violations,
            "compliance_rate": round(max(0, 100 - row.violations * 10), 1),
        }
        for row in rows
    ]


# ── Hourly Violation Heatmap ─────────────────────────────────────────────────
@analytics_router.get("/violations/hourly")
async def hourly_violations(days: int = Query(30, ge=7, le=365),
                             db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    r = await db.execute(
        select(func.extract('hour', Violation.detected_at).label("hour"),
               func.count().label("count"))
        .where(Violation.detected_at >= since)
        .group_by(func.extract('hour', Violation.detected_at))
        .order_by(func.extract('hour', Violation.detected_at))
    )
    rows = {int(row.hour): row.count for row in r.all()}
    return [
        {"hour": h, "label": f"{h:02d}:00", "violations": rows.get(h, 0)}
        for h in range(24)
    ]
