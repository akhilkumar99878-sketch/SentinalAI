"""
Pydantic v2 schemas for all API endpoints.
"""
import uuid
from datetime import datetime, date
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, EmailStr


# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: str | None = None


# ══════════════════════════════════════════════════════════════════════════════
# USERS
# ══════════════════════════════════════════════════════════════════════════════
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: Literal["ADMIN", "SAFETY_OFFICER", "SUPERVISOR"] = "SAFETY_OFFICER"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: Literal["ADMIN", "SAFETY_OFFICER", "SUPERVISOR"] | None = None
    is_active: bool | None = None
    password: str | None = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    is_active: bool
    last_login: datetime | None = None
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# WORKERS
# ══════════════════════════════════════════════════════════════════════════════
class WorkerBase(BaseModel):
    worker_code: str
    name: str
    department: str | None = None

class WorkerCreate(WorkerBase):
    pass

class WorkerUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
    is_active: bool | None = None

class WorkerResponse(WorkerBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    is_active: bool
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# LOCATIONS
# ══════════════════════════════════════════════════════════════════════════════
class LocationBase(BaseModel):
    name: str
    description: str | None = None

class LocationCreate(LocationBase):
    pass

class LocationResponse(LocationBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# CAMERAS
# ══════════════════════════════════════════════════════════════════════════════
class CameraBase(BaseModel):
    camera_code: str
    name: str
    location_id: uuid.UUID | None = None
    source_type: Literal["IMAGE", "VIDEO", "WEBCAM", "RTSP"] = "WEBCAM"
    source_url: str | None = None

class CameraCreate(CameraBase):
    pass

class CameraUpdate(BaseModel):
    name: str | None = None
    location_id: uuid.UUID | None = None
    source_type: Literal["IMAGE", "VIDEO", "WEBCAM", "RTSP"] | None = None
    source_url: str | None = None
    status: Literal["ONLINE", "OFFLINE", "CONNECTING", "ERROR"] | None = None

class CameraResponse(CameraBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    status: str
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# DETECTION
# ══════════════════════════════════════════════════════════════════════════════
class BoundingBox(BaseModel):
    x1: float; y1: float; x2: float; y2: float

class DetectedObject(BaseModel):
    label: str
    confidence: float
    bbox: BoundingBox

class WorkerDetection(BaseModel):
    worker_index: int
    bbox: BoundingBox
    confidence: float
    detected_ppe: list[str]
    missing_ppe: list[str]
    is_compliant: bool

class DetectionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    worker_count: int
    workers: list[WorkerDetection]
    all_detections: list[DetectedObject]
    compliant_count: int
    violation_count: int
    overall_compliant: bool
    annotated_image_url: str | None = None
    incident_id: str | None = None
    model_info: dict[str, Any] = {}


# ══════════════════════════════════════════════════════════════════════════════
# VIOLATIONS
# ══════════════════════════════════════════════════════════════════════════════
class ViolationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    camera_id: uuid.UUID | None
    worker_id: uuid.UUID | None
    violation_type: str
    missing_ppe: list[str]
    confidence: float | None
    evidence_path: str | None
    detected_at: datetime
    created_at: datetime

class PaginatedViolations(BaseModel):
    items: list[ViolationResponse]
    total: int
    page: int
    size: int
    pages: int


# ══════════════════════════════════════════════════════════════════════════════
# INCIDENTS
# ══════════════════════════════════════════════════════════════════════════════
class IncidentCreate(BaseModel):
    violation_id: uuid.UUID | None = None
    description: str | None = None
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"

class IncidentUpdate(BaseModel):
    status: Literal["OPEN", "ASSIGNED", "INVESTIGATING", "RESOLVED"] | None = None
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None
    assigned_to: uuid.UUID | None = None
    description: str | None = None

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    violation_id: uuid.UUID | None
    description: str | None
    status: str
    severity: str
    assigned_to: uuid.UUID | None
    created_at: datetime
    updated_at: datetime | None
    resolved_at: datetime | None

class PaginatedIncidents(BaseModel):
    items: list[IncidentResponse]
    total: int
    page: int
    size: int
    pages: int


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════════════════
class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    incident_id: uuid.UUID | None
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════
class OverviewStats(BaseModel):
    total_workers: int | None = None
    active_cameras: int | None = None
    today_violations: int | None = None
    compliance_rate: float | None = None
    open_incidents: int | None = None
    total_incidents: int | None = None
    safety_score: float | None = None
    formula: str | None = None
    has_data: bool = False
    has_detection_data: bool = False
    has_worker_data: bool = False
    has_camera_data: bool = False
    has_incident_data: bool = False

class DailyTrend(BaseModel):
    date: str
    violations: int
    compliance_rate: float

class PPEBreakdownItem(BaseModel):
    ppe_item: str
    count: int
    percentage: float

class CameraStat(BaseModel):
    camera_id: str
    camera_name: str
    location: str | None
    violations: int
    compliance_rate: float

class AIStatus(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_loaded: bool
    model_path: str
    device: str
    confidence_threshold: float
    classes: list[str]
    status: str
