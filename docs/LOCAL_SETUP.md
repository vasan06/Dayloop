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

## Start
Run `backend/run_local.ps1`. It installs the Python requirements, checks `DATABASE_URL`, applies unapplied SQL migrations and starts the API at `http://127.0.0.1:8000`. If port 8000 is already in use, stop the old DayLoop API process before restarting so the running code matches the current workspace.

Start the web app separately with `npm run dev` from the repository root. Confirm the API and PostgreSQL connection at `http://127.0.0.1:8000/api/v1/health/ready`; the dashboard also shows a live backend connection status.
