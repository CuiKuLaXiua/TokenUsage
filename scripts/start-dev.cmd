@echo off
cd /d D:\code\TokenUsage
set ELECTRON_RENDERER_URL=http://localhost:3000
start "Vite" cmd /c "npx vite"
timeout /t 5 /nobreak >nul
start "Electron" cmd /c "npx electron ."
