# NEXORA PROGRESS LOG

## Current Tier / Slice
**Tier 1 — Contracts & Foundations**  
Slice 1.1: Backend foundation (config, DB session, FastAPI app scaffold, health endpoint)  
Slice 1.2: Flutter foundation (pubspec deps, theme tokens, router, app shell, updated main.dart)

---

## Tier 0 — Inventory & Baseline (COMPLETED)

### Toolchain Verification (observed, 2026-10-14)
| Tool | Status | Version / Location | Notes |
|---|---|---|---|
| Flutter | ⚠ NOT IN PATH | 3.47.7 stable, Dart 3.13.5 | Located at `C:\Users\Admin\Downloads\flutter_windows_3.47.7-stable\flutter\bin\flutter.bat` |
| Android SDK | ✓ | SDK 36.0.0 | Detected by `flutter doctor` |
| Visual Studio (C++) | ✗ MISSING | Not installed | Required for Windows desktop builds; blocks Windows release |
| Python | ✓ | 3.12.0 (CPython, 64-bit) | `C:\Users\Admin\AppData\Local\Programs\Python\Python312\` |
| Java | ✓ | Oracle JDK in `C:\Program Files\Common Files\Oracle\Java\javapath` | Detected via flutter doctor |
| PostgreSQL | ❓ UNKNOWN | Not verified | Backend needs a running PG instance |
| Git | ✓ | `C:\Program Files\Git\cmd\git.exe` | Present (no git commands will be run per Rule 2) |

**flutter doctor output (2026-10-14):**
```
[!] Flutter — not on PATH
[✓] Windows Version — Windows 11 25H2
[✓] Android toolchain — SDK 36.0.0
[✗] Visual Studio — not installed (Windows desktop builds blocked)
[✓] Chrome
[✓] Connected device (3 available)
[✓] Network resources
```

### Flutter Project State
- **SDK constraint:** `sdk: ^3.13.5` — matches installed Dart 3.13.5 ✓
- **pubspec.yaml:** Default Flutter counter app. Only `cupertino_icons: ^1.0.8` added. No state management, routing, network, or storage packages.
- **lib/main.dart:** Default counter app. Not NEXORA code.
- **lib/app/router/** — empty directory scaffold
- **lib/app/theme/** — empty directory scaffold
- **lib/core/config, constants, errors, network, utils, widgets/** — empty directory scaffolds
- **lib/data/models, repositories, sources/** — empty
- **lib/shared/models, widgets/** — empty
- **lib/features/auth, tasks, notes, projects, habits, goals, calendar, dashboard, settings/** — directory scaffolds only, no Dart files
- **test/widget_test.dart:** Default counter test — will be replaced as features land

### Backend Project State
- **requirements.txt:** fastapi, uvicorn[standard], sqlalchemy, psycopg[binary], alembic, pydantic-settings, python-dotenv, email-validator, PyJWT, pwdlib[argon2] — versions **NOT pinned** ⚠
- **backend/app/main.py:** Empty file
- **backend/app/core/config.py:** Empty file
- **backend/app/db/base.py:** Empty file
- **backend/app/db/session.py:** Empty file
- **backend/app/.env.example:** Empty file
- **backend/alembic.ini:** Empty file
- **backend/migrations/versions/:** Empty — no migrations exist
- **backend/tests/:** Empty
- **backend/app/models, schemas, services, repositories:** Only `__init__.py` stubs

### Existing Tests
- Flutter: `test/widget_test.dart` — default counter smoke test (will be superseded)
- Backend: none

### Decisions & Assumptions
- **DA-001:** Flutter binary path is `C:\Users\Admin\Downloads\flutter_windows_3.47.7-stable\flutter\bin\flutter.bat`. All Flutter commands must use this full path until PATH is configured by the user.
- **DA-002:** Windows desktop builds are **blocked** pending Visual Studio C++ installation. Android builds can proceed.
- **DA-003:** State management: **flutter_bloc** (bloc pattern, testable, no generated code required). Routing: **go_router**. Chosen over alternatives for production track record and pub.dev maintenance score.
- **DA-004:** Local encrypted storage: **sqflite** + manual AES-256-GCM (via `encrypt` package) pending ADR-001 evaluation of SQLCipher cross-platform support. Will revisit when Tier 4 begins.
- **DA-005:** Backend requirements.txt versions will be pinned in Tier 1 slice 1.1.
- **DA-006:** PostgreSQL must be running and accessible before backend can be tested. DB URL will come from `.env` (never hardcoded).
- **DA-007:** `python -m pip` commands were denied by user in this session; backend venv at `D:\NEXORA\nexora\backend\.venv` assumed to be pre-configured or will need user to run `pip install -r requirements.txt`.

### Blocked Items
- **BLOCKED-001:** Windows release builds — Visual Studio with C++ workload required
- **BLOCKED-002:** Flutter not in system PATH — must use full path or user must add to PATH
- **BLOCKED-003:** PostgreSQL availability unknown — backend integration tests cannot run until DB confirmed

---

## Tier 1 — Contracts & Foundations

### Slice 1.1 — Backend Foundation
**Status: IN PROGRESS**

Files being created:
- `backend/requirements.txt` — pinned versions
- `backend/.env.example` — all required env vars documented
- `backend/alembic.ini` — proper Alembic config
- `backend/app/core/config.py` — Settings via pydantic-settings
- `backend/app/core/security.py` — JWT, Argon2, token helpers
- `backend/app/db/base.py` — SQLAlchemy declarative base
- `backend/app/db/session.py` — async engine + session factory
- `backend/app/main.py` — FastAPI app with lifespan, CORS, health/readiness
- `backend/app/api/v1/__init__.py` — router aggregation
- `backend/migrations/env.py` — Alembic async migration env

### Slice 1.2 — Flutter Foundation
**Status: IN PROGRESS**

Files being created/updated:
- `pubspec.yaml` — add go_router, flutter_bloc, dio, etc.
- `lib/main.dart` — NEXORA app entry point
- `lib/app/theme/app_theme.dart` — design tokens
- `lib/app/router/app_router.dart` — go_router routes
- `lib/core/network/api_client.dart` — Dio HTTP client

---

## .bak Files Created
_(none yet — will be listed here before any risky edit)_

---

## Commands Run with Results
| Command | Result |
|---|---|
| `C:\...\flutter.bat --version` | Flutter 3.47.7, Dart 3.13.5 — exit 0 |
| `C:\...\flutter.bat doctor` | 2 issues: no PATH, no Visual Studio — exit 0 |
| `python --version` | Python 3.12.0 — exit 0 |

---

## Next Slices
1. Tier 1 Slice 1.1 — Backend foundation (current)
2. Tier 1 Slice 1.2 — Flutter foundation (current, parallel)
3. Tier 2 — Auth (backend + Flutter)
4. Tier 3 — Core vertical slices (Tasks first)
