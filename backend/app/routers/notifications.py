"""Notifications and WebSocket router."""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import User, Notification
from app.schemas.schemas import NotificationResponse
from app.websocket.manager import manager

notif_router = APIRouter(prefix="/api/notifications", tags=["Notifications"])
ws_router = APIRouter(tags=["WebSocket"])


@notif_router.get("/", response_model=list[NotificationResponse])
async def list_notifications(db: AsyncSession = Depends(get_db),
                             current: User = Depends(get_current_user)):
    r = await db.execute(
        select(Notification)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return r.scalars().all()


@notif_router.post("/{notif_id}/read")
async def mark_read(notif_id: str, db: AsyncSession = Depends(get_db),
                    _: User = Depends(get_current_user)):
    import uuid
    r = await db.execute(select(Notification).where(Notification.id == uuid.UUID(notif_id)))
    n = r.scalars().first()
    if n:
        n.is_read = True
        await db.flush()
    return {"status": "ok"}


@notif_router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    r = await db.execute(select(Notification).where(Notification.is_read == False))
    for n in r.scalars().all():
        n.is_read = True
    await db.flush()
    return {"status": "ok"}


@ws_router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    Real-time WebSocket endpoint.
    Dashboard connects here to receive live violation alerts:
    {
      "type": "violation",
      "incident_id": "...",
      "severity": "HIGH",
      "missing_ppe": ["helmet"],
      "timestamp": "..."
    }
    """
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)
