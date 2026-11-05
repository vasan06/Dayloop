$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $BackendRoot "..\.env"
$EnvExample = Join-Path $BackendRoot "..\.env.example"
if (-not (Test-Path $EnvFile)) {
    Copy-Item $EnvExample $EnvFile
    Write-Host "Created .env from the example. Set DATABASE_URL, then run this script again." -ForegroundColor Yellow
    exit 1
}
Set-Location $BackendRoot
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv\Scripts\python.exe -m app.db.migrate
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
