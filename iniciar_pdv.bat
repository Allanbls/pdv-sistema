@echo off
cd /d "%~dp0"
start "" chrome --app=http://localhost:3000
node server.js