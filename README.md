# DayLoop

DayLoop is a personal-first life workspace combining Notion-inspired knowledge management, Todoist-inspired task execution, habit practice, goals, basic finance and everyday planning.

## Product and engineering principles
- Personal-first, private by default, designed to support future multi-user workspaces.
- Python application code uses cohesive `def` / `async def` functions; no authored application classes.
- PostgreSQL is the only application database. No MongoDB, SQLite or Redis.
- Free/open-source-first development, local attachment storage and no mandatory paid infrastructure.
- React function components, responsive layouts and a distinctive warm editorial visual identity.

## Implemented foundation
- React + TypeScript + Vite frontend, custom design tokens, responsive dashboard and PWA shell caching.
- FastAPI API with Firebase ID-token verification for production and a local-only development identity.
- SQL migrations for users, projects, tasks, dependencies, notes/blocks, habits, finance, budgets, savings, goals, trackers, calendar, notifications and attachments.
- Persistent projects and task CRUD, subtasks, status/priority, project assignment and dependency cycle checks.
- Notes pages and editable typed blocks.
- Habit schedules and daily entries.
- Basic income/expense transactions, categories, monthly budgets and savings goals.
- Goals, custom trackers and calendar events.
- PostgreSQL-backed in-app reminder jobs and a separate worker process.
- Global search across tasks, projects, notes, habits and goals.
- Private local attachment upload/download/delete with size/type checks and path traversal protection.
- Firebase email/password and Google sign-in with required profile onboarding in production mode.

## Local setup
1. PostgreSQL 17 is suitable. In pgAdmin Query Tool, connect as a database administrator and run:
   `CREATE ROLE dayloop LOGIN PASSWORD 'choose-a-local-password';`
   `CREATE DATABASE dayloop OWNER dayloop;`
2. Copy root `.env.example` to `.env`. Set `DATABASE_URL` to the password and database created above. Keep `DAYLOOP_AUTH_MODE=development` only for local development.
3. Run PowerShell: `cd D:\dayloop\backend; .\run_local.ps1`. This creates a Python environment if needed, installs dependencies, applies pending migrations and starts the API at `http://127.0.0.1:8000`.
4. In a second terminal: `cd D:\dayloop; npm install; npm run dev`. Open the Vite URL shown in the terminal, normally `http://localhost:5173`.
5. Copy `frontend/.env.example` to `frontend/.env` and add your Firebase web app settings to enable email/password and Google sign-in. For local API-only testing, use **Continue with local development identity** on the sign-in page.
6. Optional in-app reminder worker: in another terminal run `cd D:\dayloop\backend; .\run_worker.ps1`.

## Production authentication
- Create a Firebase project on the no-cost Spark plan and enable Email/Password and Google authentication under **Authentication → Sign-in method**.
- Copy the Firebase web configuration into `frontend/.env.local` using `frontend/.env.example`.
- Configure `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` and `DAYLOOP_AUTH_MODE=firebase` on the API host.
- New email and Google accounts complete a DayLoop profile (name, unique username, age and role) before the workspace opens.
- Never commit service-account credentials or `.env` files. Development identity is disabled when `DAYLOOP_ENV=production`.

## Checks
- Frontend production build: `npm run build`
- Backend tests: `cd backend; .\.venv\Scripts\python.exe -m pytest -q`
- Backend syntax: `cd backend; .\.venv\Scripts\python.exe -m compileall -q app tests`

## Run commnds
- Backend:
    `cd D:\dayloop\backend`
    `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
    `curl http://127.0.0.1:8000/api/v1/health`
- Frontend:
    `cd D:\dayloop`
    `npm run dev --workspace frontend -- --host 127.0.0.1`
- Database:
    `psql -U dayloop -h 127.0.0.1 -p 5432 -d dayloop`

## URLS
- App: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000`
- API documentation: `http://127.0.0.1:8000/docs`
- Backend health: `http://127.0.0.1:8000/api/v1/health`

## Known incomplete areas
The API and database require PostgreSQL to be running with a configured role/password. Email and browser-push delivery adapters, full offline mutation queue/conflict sync, recurring task scheduler, advanced task timeline/dependency UI, rich note collections/backlinks/revisions, deeper analytics beyond the current progress charts, learning/journal/reviews, data export/backup and full end-to-end/browser/security tests remain to be completed. The PWA service worker currently caches the application shell only; it does not claim full offline data synchronization.
