# Local database setup

DayLoop uses PostgreSQL only. SQLite and MongoDB are not supported.

## Create a local database
In pgAdmin, connect to your local PostgreSQL server as an administrator and run:

```sql
CREATE ROLE dayloop LOGIN PASSWORD 'choose-a-local-password';
CREATE DATABASE dayloop OWNER dayloop;
```

If the role already exists, use `ALTER ROLE dayloop WITH PASSWORD 'choose-a-local-password';` instead. Do not expose the local PostgreSQL port to public networks.

## Configure the API
Copy the root `.env.example` to `.env`, then set:

```dotenv
DAYLOOP_ENV=development
DAYLOOP_AUTH_MODE=development
DATABASE_URL=postgresql://dayloop:choose-a-local-password@127.0.0.1:5432/dayloop
```

The development identity header is accepted only when `DAYLOOP_ENV` is not `production`. Production must use Firebase token verification.

## Configure sign-in
Copy `frontend/.env.example` to `frontend/.env` and add the Firebase web app settings for email/password sign-in. To enable Google sign-in, open **Firebase Console → Authentication → Sign-in method**, enable **Google**, and save. Add the local frontend host (normally `localhost`) to the authorized domains if Firebase requests it. New Google and email accounts are asked for a display name, username, age and role before entering DayLoop.

Without Firebase web settings, the sign-in page offers a development-only local identity. This uses the backend's local development auth mode and is not available in production.

## Start manually (Git Bash only)

Install the backend environment once, if it does not already exist:
```bash
cd /d/dayloop/backend
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements.txt
```

Apply database migrations deliberately when needed:
```bash
python -m app.db.migrate
```

Start the API in the foreground so every startup message, request and error is visible in the same Git Bash terminal:
```bash
cd /d/dayloop/backend
source .venv/Scripts/activate
python app.py
```
Keep this terminal open. Press `Ctrl+C` to stop the API. Do not start another copy while port 8000 is occupied.

In a second Git Bash terminal, start the web app:
```bash
cd /d/dayloop/frontend
npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
```

Confirm the API and PostgreSQL connection at `http://127.0.0.1:8000/api/v1/health/ready`; the dashboard also shows a live backend connection status.
