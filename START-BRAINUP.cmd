@echo off
setlocal
cd /d "%~dp0"
set "BRAINUP_NODE=C:\Users\KO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%BRAINUP_NODE%" set "BRAINUP_NODE=node"
echo BrainUp local preview: http://127.0.0.1:4173
echo Keep this window open while using the local site.
"%BRAINUP_NODE%" scripts\preview.mjs
pause
