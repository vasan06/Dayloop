# DayLoop

**DayLoop** is a personal-first productivity and life-management workspace for planning, execution, reflection, and tracking. One React application powers the browser experience and the Capacitor Android build; a Python API owns server-side logic and PostgreSQL persistence.

> Status: actively developed web V1; Android debug-build integration is included. An APK build is **not** a guarantee that every browser integration already works natively.

## Product

| Area | Current experience |
| --- | --- |
| Landing and accounts | Public landing, sign-in/sign-up, Firebase email/password and Google web sign-in, account onboarding and profile |
| Dashboard | Daily overview, shortcuts, progress indicators, activity heatmap |
| Tasks | Task lists, details, status, priority, subtasks, project assignment and dependencies |
| Projects | Projects, task organisation, project details and custom banners |
| Habits | Scheduled habit tracking, check-ins, streaks and activity history |
| Calendar | Events with completion and deletion actions |
| Notes | Editable pages and typed knowledge blocks |
| Focus | Timer, stopwatch and alarm interfaces |
| Finance | Income and expenses, transactions, categories, budgets and savings goals |
| Trackers | Custom tracked metrics and progress |
| Analytics | Progress visualisations and activity heatmaps |
| Settings | Workspace, appearance and account preferences |
| Admin | Administration interface (access depends on backend authorization) |

Features should be verified on the intended environment before treating them as production-ready. Some integrations (e.g. alarm delivery while the app is closed, OAuth on embedded WebViews, offline mutation sync) need additional native or backend work.

## Architecture

```text
frontend/ ─ React 19, TypeScript, Vite, React Router, TanStack Query
     │      └─ shared web UI, pages, Firebase web auth, CSS
     ├─ Browser / PWA
     └─ mobile/ ─ Capacitor Android shell and GitHub Actions APK
                     │
                     ▼
backend/ ─ Python FastAPI API (Firebase token verification)
     │
     ├─ PostgreSQL (application records)
     ├─ Local attachment storage (configured on API host)
     └─ Optional PostgreSQL-backed reminder worker
```

No SQLite, Redis, MongoDB or AWS service is required by the intended architecture. Browser and mobile clients **never connect directly to PostgreSQL**. The backend stays independently running and reachable; packaging an APK does not host the backend.

## Repository layout

```text
frontend/                 React SPA, layouts, routes, feature pages, hooks and styling
backend/                  FastAPI, migrations, models, services, tests and worker
mobile/                   Capacitor config, Android build dependencies and mobile guidance
.github/workflows/        Android internal APK CI
docs/                     Additional engineering documents
.env.example              Documented local configuration placeholders (no secrets)
README.md                 Project and setup documentation
```

## Local web development

Prerequisites: Node.js/npm, Python, PostgreSQL, Git. PostgreSQL 17 is suitable.

1. Create a dedicated PostgreSQL role and database. Use your own strong local password.
2. Copy `.env.example` to `.env`; set `DAYLOOP_ENV=development` and replace the production placeholders with your local `DATABASE_URL`, CORS origins, and API settings.
3. Create `backend/.venv`, install `backend/requirements.txt`, and apply the existing SQL migrations using the documented backend migration command.
4. Copy `frontend/.env.example` to `frontend/.env`, then configure the Firebase **web client** keys if using Firebase.
5. From the repository root run:

```bash
npm ci
npm run dev
```

The launcher (`python backend/app.py`) runs Vite and FastAPI and streams their logs in one terminal. Web UI: `http://127.0.0.1:5173`; API: `http://127.0.0.1:8000`; API docs: `http://127.0.0.1:8000/docs`.

In local-only development you can use the development identity if explicitly enabled. **Never expose a development-auth API to the public internet.**

## Android APK using GitHub Actions

The Android app **reuses every React page and browser route** from `frontend/src`; it does not copy the UI into a second mobile codebase. Capacitor packages the compiled React assets into an Android WebView.

1. Commit and push the `mobile/` directory, updated lockfile, and `.github/workflows/android-apk.yml`.
2. In GitHub **Settings → Secrets and variables → Actions → Variables**, define `DAYLOOP_API_URL` as a reachable HTTPS URL ending in `/api/v1`. For example: `https://api.example.com/api/v1` (replace with your actual host).
3. Define the existing Firebase web-client `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and optional storage/messaging/measurement variables. Do not add service-account JSON, database passwords, or private keys to frontend build variables.
4. Open **Actions → Android Internal APK → Run workflow** on the branch containing the changes.
5. Download `app-internal.apk` from the `dayloop-android-debug-apk` artifact. Confirm the installed app uses the same signing certificate before testing an in-place update.

The workflow builds the Vite SPA, synchronizes it into the Capacitor project, and packages a non-debuggable internal APK with the existing APK signing certificate. CI verifies the package, version code, and signer before upload.

### Android limitations and prerequisites

- **Backend/database:** Keep your current Python API and PostgreSQL; however, both must be available to the phone through a reachable API endpoint. `localhost` on Android means the Android device, not your PC. Backend CORS must allow the Android WebView origin as appropriate.
- **Firebase:** Enable Google as a sign-in provider and register the APK signing certificate fingerprints for `com.dayloop.app` in the existing Firebase project. Android obtains a Google ID token through the native account picker and exchanges it with the Firebase Web SDK. See the [mobile configuration guide](mobile/README.md#api-and-firebase).
- **Native behavior:** Browser notifications, push, alarm scheduling when closed, attachment pickers, deep links, back navigation and offline data sync need device verification or Capacitor/native integrations. Do not promise their native behavior solely from a successful APK build.
- **Configuration:** Android compiled assets must use `VITE_API_URL` pointing to HTTPS. App frontend build settings are publicly extractable from an APK; they must not contain secrets.
- **Development:** See [mobile/README.md](mobile/README.md) for local Android commands and the native build lifecycle.

## Authentication and data security

Firebase Authentication verifies users in production; FastAPI verifies Firebase ID tokens and authorizes access to application records. Store Firebase Admin credentials and `DATABASE_URL` **only on the API host**. Keep `.env`, service-account JSON, Android keystores and secrets untracked. Client-side Firebase app configuration is not equivalent to backend administrator credentials.

## Render, Supabase and legacy data cutover

`render.yaml` hosts only the FastAPI backend. Configure its `DATABASE_URL` with the Supabase PostgreSQL pooler connection string and `sslmode=require` (or stronger); production rejects a database URL without TLS. Set `FIREBASE_PROJECT_ID=dayloop-a5c00`, `DAYLOOP_ENV=production`, `DAYLOOP_AUTH_MODE=firebase`, a long random `DAYLOOP_ADMIN_KEY`, and `CORS_ORIGINS` containing the web origin and `https://localhost` for Android. Keep database credentials and the admin key out of `VITE_*` and APK settings. Set web `VITE_API_URL` and GitHub Actions `DAYLOOP_API_URL` to the public HTTPS Render URL ending in `/api/v1`. The actual Render URL must be supplied after service creation.

Run `python -m app.db.migrate` from `backend` against staging first; the runner records applied migration filenames and skips them on rerun. Before any legacy import, export every device's pending edits and conflicts, make a separate SQLite backup, and preserve both originals and exports. Use `python -m app.db.import_sqlite SOURCE.sqlite BACKUP.sqlite` for backup and inventory, then use a fresh backup path with `--apply` only against staging. The importer rolls back on conflicting rows and verifies imported counts and Firebase UIDs. Compare relationships and authenticated records against the source before production cutover. Mobile SQLite and its legacy queue remain installed until this per-device reconciliation is complete; removing the dependency now risks losing unsent edits. Supabase backup and recovery should use the project's supported database backup or `pg_dump`/`pg_restore` procedures, verified with a staging restore before cutover.

The daily `DayLoop service health` GitHub Actions workflow checks public health and admin-key-protected database readiness with bounded retries for cold starts. Set GitHub variable `DAYLOOP_API_URL` and secret `DAYLOOP_ADMIN_KEY` to match the backend. Optional `DAYLOOP_DB_WARN_BYTES` emits a database-size warning. GitHub Actions failure alerts report outages; the workflow does not keep the service awake or prevent provider quota and inactivity limits.

## Validation

```bash
npm run build
npm run typecheck
cd backend
.venv/Scripts/python.exe -m pytest -q
```

For Android, use the GitHub Actions debug build and perform on-device smoke testing of login, API connectivity, main navigation, task CRUD, calendar event completion, notes, finance, habits, and Focus screens.

## Development status / roadmap

The existing React interfaces and API foundation support the product areas above. Still requiring end-to-end validation or expansion: complete offline mutation sync and conflict resolution, push/email adapter delivery, recurring scheduling, enhanced knowledge-management features, extensive browser/mobile accessibility and security tests, native Google authentication, native alarm/background execution, production backend hosting and release signing.

## License

See [LICENSE](LICENSE).
