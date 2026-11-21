# DayLoop Android SQLite and PostgreSQL sync

## Local architecture

Web browsers continue to use FastAPI and PostgreSQL through the existing API.
Android uses Capacitor SQLite to keep per-Firebase-user response snapshots and
outgoing changes locally. FastAPI remains the only path into PostgreSQL.
PostgreSQL migration `009_sync_change_log.sql` creates a per-user change feed
that includes writes made through existing PC routes.

## First launch

1. Sign in with Firebase while the backend is reachable.
2. The profile request creates the user's local SQLite database. When workspace
   loads, the app downloads existing lists and supported nested records.
3. After first successful download, cached features can open with the backend offline.

## Offline edits and synchronization

- Supported JSON POST/PATCH/PUT/DELETE mutations are written into an SQLite
  outbox when the API is unreachable. Original server records are kept as
  conflict baselines. Basic local list/detail snapshots are updated immediately.
- The sync loop retries when the app regains foreground/network connectivity
  and every 30 seconds while active.
- The backend sync feed is read using `GET /api/v1/sync/changes?after=N`
  with Firebase user scoping; stored cursors enable incremental pulls.
- Conflicts require manual choice in Settings > Mobile synchronization. The
  app never silently replaces an explicitly conflicting edited field.
- Native notification scheduling remains available without a server.

## Limits and remaining engineering work

**This is an integration foundation, not a certified fully offline release.**
The current SQLite cache/outbox is not a normalized offline port of every
PostgreSQL table, and generic optimistic updates do not reproduce every
FastAPI service validation, dependency, streak, or finance invariant.

- Direct network-dependent routes, attachments and binary file transfers,
  admin operations, first-time authentication, email recovery and feedback
  need dedicated offline behavior where appropriate.
- The current REST outbox replay is not crash-proof idempotent: an ambiguous
  timeout after a server-side POST can result in a duplicate when retried.
  Production use requires transactionally idempotent server mutations.
- Changes to the same nested note blocks need structured block-level merge
  and further conflict tests.
- Client and server version checking must be made atomic to eliminate
  the read/check/write race during concurrent edits.
- The unencrypted local SQLite file should be protected with an approved
  device-key encryption scheme before storing sensitive finance/notes.
- Native plugin operation and app background/resume behavior require actual
  Android device or emulator QA; Capacitor sync and TypeScript builds alone
  do not verify them.
- Do not treat local device data as automatically backed up. Implement
  recovery, import/export, and retention before publishing the app.

## Development

Start FastAPI with `DAYLOOP_HOST=0.0.0.0 python backend/app.py` while
testing over LAN. Set the GitHub Actions variable `DAYLOOP_API_URL` to the
reachable `http://<PC-IP>:8000/api/v1` for LAN testing (use HTTPS for
production). Run `npm run build` then `cd mobile && npx cap sync android`.

Backend tests: set `DAYLOOP_TEST_DATABASE_URL` to a test-accessible
PostgreSQL connection and run `python -m pytest backend/tests` from the root.
The integration suite isolates its schema and rolls back test changes.

No GitHub remote changes or deployment actions are performed by this work.
