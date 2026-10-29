@echo off
chcp 65001 > nul
title EA FC 26 Career Tracker v3.1
echo ======================================================================
echo           EA FC 26 CAREER TRACKER — SERVIDOR LOCAL (v3.1)
echo ======================================================================
echo.
echo Iniciando servidor local e abrindo interface web...
echo.
python "%~dp0src\app.py"
pause
