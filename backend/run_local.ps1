$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $BackendRoot "..\.env"
$EnvExample = Join-Path $BackendRoot "..\.env.example"
if (-not (Test-Path $EnvFile)) {
    if (-not (Test-Path $EnvExample)) {
        throw "Missing $EnvFile and the setup template $EnvExample."
    }
    Copy-Item $EnvExample $EnvFile
    Write-Host "Created .env from the example. Set DATABASE_URL, then run this script again." -ForegroundColor Yellow
    exit 1
}
Set-Location $BackendRoot
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "Could not create the backend virtual environment." }
}
$Python = Join-Path $BackendRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "Backend Python was not found at $Python." }

& $Python -c "from app.core.config import get_settings; import sys; sys.exit(0 if get_settings()['database_url'] else 1)"
if ($LASTEXITCODE -ne 0) {
    throw "DATABASE_URL is missing. Set it in the repository-root .env file and run this script again."
}

& $Python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed; the API was not started." }

& $Python -m app.db.migrate
if ($LASTEXITCODE -ne 0) {
    throw "Database migrations failed. Confirm PostgreSQL is running and DATABASE_URL is correct."
}

& $Python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
if ($LASTEXITCODE -ne 0) {
    throw "The API could not bind to http://127.0.0.1:8000. Check whether another process is already using port 8000."
}
