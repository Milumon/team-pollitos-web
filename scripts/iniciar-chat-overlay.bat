@echo off
title TikTok Live Chat Listener - Team Pollito
color 0E
echo ========================================================
echo   TEAM POLLITO - INICIANDO LECTOR DE CHAT TIKTOK LIVE
echo ========================================================
echo.
cd /d "%~dp0\.."
node scripts/tiktok-live-listener.cjs
pause
