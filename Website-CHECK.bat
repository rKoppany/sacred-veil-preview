@echo off
setlocal

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local-site.ps1"

if errorlevel 1 (
  echo.
  echo A helyi weboldal inditasa hibat jelzett.
  echo Az ablak nyitva marad, hogy a fenti uzenet olvashato legyen.
  echo.
  pause
)
