# DayLoop

**DayLoop** is a personal-first productivity and life-management workspace for planning, execution, reflection, and tracking. One React application powers the browser experience and the Capacitor Android build; a Python API owns server-side logic and PostgreSQL persistence.

> Status: actively developed web and Android V1. The in-app APK updater is implemented on the development branch; native installation and data-preservation verification are pending.

## Product

| Area | Current experience |
| --- | --- |
| Landing and accounts | Public landing, sign-in/sign-up, Firebase email/password and Google web sign-in, account onboarding and profile |
| Dashboard | Daily overview, shortcuts, progress indicators, activity heatmap |
| Tasks | Task lists, details, status, priority, subtasks, project assignment and dependencies |
| Projects | Projects, task organisation, project details and custom banners |
| Habits | Scheduled habits, dated check-ins, measurable inputs, streak charts and grouped activity ranges |
| Calendar | Events with completion and deletion actions |
| Notes | Editable pages and typed knowledge blocks |
| Finance | Income and expenses, transactions, categories, budgets and savings goals |
| Trackers | Custom tracked metrics and progress |
| Analytics | Progress visualisations and activity heatmaps |
| Settings | Workspace, appearance, account preferences and release history |
| Admin | Administration interface (access depends on backend authorization) |

Features should be verified on the intended environment before treating them as production-ready. Some integrations (e.g. background notification submissions, native OAuth, offline mutation sync) need additional native or backend work.

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

PostgreSQL remains the server-side source of truth; Android uses local SQLite for offline workspace data and queued changes. Redis, MongoDB and AWS are not required. Browser and mobile clients **never connect directly to PostgreSQL**. The backend stays independently running and reachable; packaging an APK does not host the backend.

## Repository layout

```text
frontend/                 React SPA, layouts, routes, feature pages, hooks and styling
backend/                  FastAPI, migrations, models, services, tests and worker
mobile/                   Capacitor config, Android build dependencies and mobile guidance
.github/workflows/        Signed Android APK CI and release publishing
scripts/publish_android.py  GitHub Releases publisher
release.json               Product version and release notes
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

## Android installation and in-app updates

DayLoop shares its React frontend between web and Capacitor Android. APK distribution uses GitHub Releases rather than Supabase Storage, keeping update traffic separate from the application database and Render API.

### First installation (one time)

1. Review the development branch and merge approved changes into main.
2. Open [GitHub Actions](https://github.com/vasan06/DayLoop/actions) and check the Android Internal APK workflow.
3. After successful publishing, open [GitHub Releases](https://github.com/vasan06/DayLoop/releases) and download DayLoop.apk directly. No ZIP extraction is necessary.
4. Install over the existing app if its application ID and signing certificate match and the new version code is higher. Otherwise, back up or sync all local data before considering a one-time reinstall.

### Future updates

The updater-enabled Android app checks the public GitHub release API at launch and on resume, with a six-hour in-session polling interval. When a newer compatible version is advertised, it presents release notes and an Update now button. Android may require permission to install from DayLoop and a system installer confirmation. Compatible upgrades preserve application storage; the updater does not clear storage or sign users out. Actual upgrade data preservation still requires device testing.

### CI and publishing

Eligible pushes to main build the React app, sync Capacitor, compile the signed internal APK, and verify package identity, version and certificate. The publisher creates a draft release, uploads DayLoop.apk and update.json, verifies the uploaded APK hash, and publishes the release last. Manually dispatched non-main builds produce an artifact only. Artifact retention is three days.

The publisher requires a public release repository for token-free downloads. The workflow uses its built-in GitHub token; no Supabase updater bucket, table or service-role credential is required.

### GitHub configuration

- Repository variables: DAYLOOP_API_URL (HTTPS ending in /api/v1), VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, and optional Firebase client variables.
- Existing repository secret: DAYLOOP_ANDROID_DEBUG_KEYSTORE_BASE64. Preserve and privately back up the exact signing keystore.
- Optional secret: FIREBASE_ANDROID_JSON_BASE64 for the Android Firebase client configuration.
- Optional variable: DAYLOOP_VERSION_OFFSET, a fixed offset added to GITHUB_RUN_NUMBER when necessary to ensure new build codes exceed every previously distributed version. Do not reduce the offset.

The application ID is com.dayloop.app. Do not change the signing key or application ID for routine updates. CI uses release.json for product metadata and preserves the semantic product version (currently v1.1.0) and generates the Android version code from the workflow run number plus the configured offset. The native updater verifies SHA-256, package identity, signing certificate and increasing version code before invoking Android's installer. Downloads are limited to HTTPS and approved GitHub hosts, with a 100 MiB APK limit.

### Release verification checklist

- Confirm CI package/version/certificate checks and release asset upload succeed.
- Install the first updater-enabled APK, then publish a higher-version test build.
- Verify update discovery, permissions, download interruption, incorrect checksum rejection, signature mismatch rejection and downgrade prevention.
- Confirm existing local and synced records survive the in-place update.
- Do not treat a successful web build as proof of native behavior.

### Android limitations and prerequisites

- **Backend/database:** Keep your current Python API and PostgreSQL; however, both must be available to the phone through a reachable API endpoint. `localhost` on Android means the Android device, not your PC. Backend CORS must allow the Android WebView origin as appropriate.
- **Firebase:** Enable Google as a sign-in provider and register the APK signing certificate fingerprints for `com.dayloop.app` in the existing Firebase project. Android obtains a Google ID token through the native account picker and exchanges it with the Firebase Web SDK. See the [mobile configuration guide](mobile/README.md#api-and-firebase).
- **Native behavior:** Browser notifications, push, notification actions while closed, attachment pickers, deep links, back navigation and offline data sync need device verification or Capacitor/native integrations. Do not promise their native behavior solely from a successful APK build.
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

For Android, use the signed internal APK and perform on-device smoke testing of login, API connectivity, navigation, task CRUD, calendar events, notes, finance, habits, streaks, notification actions and in-place updates. Run npm run test:e2e for available browser regression tests.

## Development status / roadmap

The existing React interfaces and API foundation support the product areas above. Still requiring end-to-end validation or expansion: complete offline mutation sync and conflict resolution, push/email adapter delivery, recurring scheduling, enhanced knowledge-management features, extensive browser/mobile accessibility and security tests, native Google authentication, native background notification submissions, deadline notifications, encrypted backup automation, offline streak history, release retention automation, native updater compilation and in-place upgrade verification.

## License

See [LICENSE](LICENSE).
