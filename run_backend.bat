@echo off
title SentinelAI-Backend
cd /d "C:\Users\Akhil\OneDrive\Desktop\Project\backend"
echo Starting Backend on http://localhost:8081 ...
uvicorn app.main:app --reload --host 0.0.0.0 --port 8081
pause
