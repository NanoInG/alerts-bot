@echo off
REM Alert Indicator launcher
REM Clear ELECTRON_RUN_AS_NODE to prevent IDE interference
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
node_modules\.bin\electron.cmd .
