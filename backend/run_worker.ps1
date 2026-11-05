$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $BackendRoot
& .\.venv\Scripts\python.exe -m app.worker
