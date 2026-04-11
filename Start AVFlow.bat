@echo off
title AVFlow
echo.
echo  Starting AVFlow...
echo.

:: Check Node is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERROR: Node.js is not installed.
  echo  Download it from https://nodejs.org and re-run this file.
  echo.
  pause
  exit /b 1
)

:: Start the server (it opens the browser automatically)
node serve.js

:: If the server exits, pause so the user can see any error
echo.
pause
