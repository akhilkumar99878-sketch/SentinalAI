# SentinelAI — AI-Driven Industrial Safety Monitoring Framework

> **An AI-Powered Industrial Safety Monitoring Platform for Real-Time PPE Compliance Detection, Incident Reporting, and Intelligent Safety Analytics Using Computer Vision**

## Overview

SentinelAI is a complete full-stack industrial safety monitoring platform that integrates:

- **YOLOv11** for real-time PPE detection
- **FastAPI** backend with PostgreSQL
- **React** dashboard with real-time WebSocket alerts
- **Incident management** with evidence capture
- **Safety analytics** and reporting

## Technology Stack

| Component | Technology |
|-----------|-----------|
| AI Engine | YOLOv11 (Ultralytics) |
| Video Processing | OpenCV |
| Backend | FastAPI 0.111 + SQLAlchemy 2.0 (async) |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Real-time | WebSockets |
| Frontend | React 18 + Vite + Tailwind CSS |
| Charts | Recharts |

## Project Structure

```
SentinelAI/
├── frontend/          # React + Vite + Tailwind
├── backend/
│   └── app/
│       ├── main.py
│       ├── core/      # config, security, dependencies
│       ├── database/  # models, session
│       ├── schemas/   # Pydantic v2
│       ├── routers/   # API endpoints
│       ├── services/  # business logic
│       ├── ai/        # YOLOv11 integration
│       └── websocket/ # real-time manager
├── model/             # YOLOv11 best.pt (user provides)
├── storage/           # uploaded files, evidence images
├── sample_data/       # seed script
└── .env.example
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- (Optional) CUDA GPU for faster inference

---

### 1. Database Setup

```sql
-- In psql or pgAdmin:
CREATE DATABASE sentinelai;
```

---

### 2. Backend Setup

```powershell
cd backend
pip install -r requirements.txt
copy .env.example .env   # then edit .env with your credentials
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend auto-creates all tables and seeds the admin user on first start.

**API Docs:** http://localhost:8000/docs

---

### 3. Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

**Dashboard:** http://localhost:5173

---

### 4. YOLOv11 Model Setup

Place your trained YOLOv11 model at:

```
model/best.pt
```

Configure in `backend/.env`:

```env
MODEL_PATH=./model/best.pt
CONFIDENCE_THRESHOLD=0.50
DEVICE=auto   # auto, cpu, cuda:0
```

The system works without a model (shows "AI Engine Offline" status).

---

### 5. Seed Demo Data

```powershell
cd backend
python ../sample_data/seed.py
```

---

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sentinelai.com | Admin@12345 |
| Safety Officer | officer@sentinelai.com | Officer@12345 |
| Supervisor | supervisor@sentinelai.com | Super@12345 |

---

## Features

### Implemented ✅

- [x] JWT authentication with role-based access (ADMIN / SAFETY_OFFICER / SUPERVISOR)
- [x] YOLOv11 PPE detection (graceful offline mode if model missing)
- [x] Image upload → YOLOv11 → compliance check → annotated result
- [x] Video upload → frame-by-frame analysis → aggregated statistics
- [x] Webcam capture → instant analysis
- [x] RTSP/CCTV architecture support
- [x] PPE-to-worker spatial association
- [x] Compliance engine (configurable required PPE)
- [x] Violation detection with evidence capture (JPEG saved)
- [x] Incident management (OPEN/ASSIGNED/INVESTIGATING/RESOLVED)
- [x] WebSocket real-time alerts to dashboard
- [x] Notification center
- [x] Camera management (CRUD)
- [x] Worker management (CRUD)
- [x] Location management
- [x] Analytics (violation trends, PPE breakdown, camera stats, safety score)
- [x] Daily/Weekly/Monthly reports
- [x] Admin user management
- [x] Dark mode + Light mode
- [x] AI status panel (Settings page)
- [x] Audit logging
- [x] Pagination on all tables
- [x] Loading states (skeleton loaders)
- [x] Empty states with helpful messages
- [x] Error handling (no raw errors shown to user)

### Future Scope 🔮

- [ ] Facial recognition for permanent worker identification
- [ ] Email / SMS / Push notification integrations
- [ ] PDF/CSV report export
- [ ] Multi-camera simultaneous streaming
- [ ] Worker-level compliance history tracking
- [ ] Predictive safety analytics
- [ ] Mobile responsive design (tablet/phone)
- [ ] Multi-site / multi-organization support
- [ ] LDAP/SSO authentication

---

## API Documentation

FastAPI Swagger UI: **http://localhost:8000/docs**

### Endpoints

| Tag | Endpoint |
|-----|---------|
| Authentication | POST /api/auth/login, GET /api/auth/me |
| Users | GET/POST/PUT/DELETE /api/users/ |
| Cameras | GET/POST/PUT/DELETE /api/cameras/ |
| Workers | GET/POST/PUT/DELETE /api/workers/ |
| Detection | POST /api/detection/image, POST /api/detection/video, GET /api/detection/status |
| Violations | GET /api/violations/ |
| Incidents | GET/POST/PUT /api/incidents/ |
| Analytics | GET /api/analytics/overview, /violations/trends, /ppe/breakdown, /cameras/stats |
| Reports | GET /api/reports/daily, /weekly, /monthly |
| WebSocket | ws://localhost:8000/ws/alerts |

---

## Safety Score Formula

```
Safety Score = 0.6 × Compliance Rate + 0.2 × (100 − Open Incident Rate) + 0.2 × Resolution Rate
```

This formula is documented and calculated from real database data — never hard-coded.

---

## Severity Classification

| Missing PPE Count | Severity |
|-------------------|---------|
| 1 item missing | MEDIUM |
| 2 items missing | HIGH |
| 3+ items missing | CRITICAL |

---

## Troubleshooting

**Backend won't start:** Check PostgreSQL is running and DATABASE_URL is correct in `.env`

**AI Engine Offline:** Place `best.pt` at `model/best.pt` and restart backend

**CORS error:** Ensure `CORS_ORIGINS` in `.env` includes your frontend URL

**WebSocket not connecting:** Check backend is running on port 8000

---

*B.Tech CSE Project — AI-Driven Industrial Safety Framework*
