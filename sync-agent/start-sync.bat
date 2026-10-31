@echo off
title Canara SD-WAN Local Sync Companion
echo ========================================================
echo   Canara Bank SD-WAN Tracker - Local SQLite Sync Bridge
echo ========================================================
echo.
echo Starting local SQLite companion on http://127.0.0.1:41732 ...
echo Keep this window open or minimized while working.
echo.
cd /d "%~dp0\.."
node sync-agent/sync.js --daemon
pause
