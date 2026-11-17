@echo off
title Dashboard Teknisi PT GPI
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    py local_test_server.py --seed
    goto end
)

where python >nul 2>nul
if %errorlevel%==0 (
    python local_test_server.py --seed
    goto end
)

echo.
echo  ============================================================
echo   Python belum terpasang di komputer ini.
echo.
echo   Silakan pasang Python 3 terlebih dahulu:
echo   https://www.python.org/downloads/
echo.
echo   PENTING: saat instalasi, centang "Add Python to PATH".
echo  ============================================================
echo.

:end
echo.
pause
