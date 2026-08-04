@echo off
REM Stops any WellPath dev servers on ports 3000 (backend) and 5173 (frontend).
echo Stopping WellPath servers...
for %%P in (3000 5173) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    echo   Killing PID %%A on port %%P
    taskkill /PID %%A /F >nul 2>&1
  )
)
echo Done.
pause
