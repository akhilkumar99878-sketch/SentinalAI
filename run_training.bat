@echo off
title SentinelAI-Training (Epoch 0 to 100)
cd /d "C:\Users\Akhil\OneDrive\Desktop\Project"
echo ============================================================
echo   SentinelAI PPE Training — Fresh Start
echo   Epoch 0 to 100 on RTX 4050
echo   DO NOT CLOSE THIS WINDOW
echo ============================================================
echo.
python train_ppe.py
echo.
echo ============================================================
echo   Training finished!
echo   Now close and reopen run_backend.bat
echo ============================================================
pause
