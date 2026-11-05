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

## Start
Run `backend/run_local.ps1`. It installs the Python requirements, applies unapplied SQL migrations and starts the API. Start the web app separately with `npm run dev` from the repository root.
