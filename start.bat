@echo off
start http://localhost:8001

echo ===================================================
echo Server is running on port 8001!
echo PC:     http://localhost:8001
echo Mobile: http://192.168.31.207:8001
echo.
echo To stop the server, close this window
echo ===================================================
echo.

python -m http.server 8001
