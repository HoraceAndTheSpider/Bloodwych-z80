@echo off
cd /d "%~dp0"
py -3 tools\serve_editor.py
if errorlevel 1 python tools\serve_editor.py
