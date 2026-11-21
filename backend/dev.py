from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
API_HOST = os.getenv("DAYLOOP_HOST", "127.0.0.1")
API_PORT = int(os.getenv("DAYLOOP_PORT", "8000"))
WEB_HOST = os.getenv("DAYLOOP_WEB_HOST", "127.0.0.1")
WEB_PORT = int(os.getenv("DAYLOOP_WEB_PORT", "5173"))
LOG = logging.getLogger("dayloop.dev")


def _get_json(url: str):
    try:
        with urllib.request.urlopen(url, timeout=1.2) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None


def _get_text(url: str):
    try:
        with urllib.request.urlopen(url, timeout=1.2) as response:
            return response.read(250_000).decode("utf-8", errors="replace")
    except Exception:
        return None


def _listener_pids(port: int) -> list[int]:
    if os.name != "nt":
        return []
    command = (
        "$ErrorActionPreference='SilentlyContinue'; "
        f"Get-NetTCPConnection -LocalPort {port} -State Listen | "
        "Select-Object -ExpandProperty OwningProcess -Unique"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", command],
        capture_output=True, text=True, check=False,
    )
    return [int(line.strip()) for line in result.stdout.splitlines() if line.strip().isdigit()]


def _process_info(pid: int) -> dict:
    if os.name != "nt":
        return {}
    command = (
        f"$p=Get-CimInstance Win32_Process -Filter 'ProcessId={pid}'; "
        "if($p){[pscustomobject]@{Name=$p.Name;CommandLine=$p.CommandLine}|ConvertTo-Json -Compress}"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", command],
        capture_output=True, text=True, check=False,
    )
    try:
        return json.loads(result.stdout.strip()) if result.stdout.strip() else {}
    except json.JSONDecodeError:
        return {}


def _stop_tree(pid: int) -> None:
    subprocess.run(
        ["taskkill.exe", "/PID", str(pid), "/T", "/F"],
        capture_output=True, text=True, check=False,
    )
    LOG.info("Stopped previous DayLoop development process (PID %s).", pid)


def _clear_dayloop_port(port: int, service: str) -> None:
    pids = _listener_pids(port)
    if not pids:
        return

    for pid in pids:
        info = _process_info(pid)
        name = str(info.get("Name", "")).lower()
        command = str(info.get("CommandLine", "")).lower()
        is_dayloop = False

        if service == "api":
            document = _get_json(f"http://{API_HOST}:{port}/openapi.json")
            is_dayloop = (
                name in {"python.exe", "pythonw.exe"}
                and "app.py" in command
                and isinstance(document, dict)
                and document.get("info", {}).get("title") == "DayLoop API"
            )
        else:
            page = _get_text(f"http://{WEB_HOST}:{port}/")
            root = str(ROOT).replace("/", "\\").lower()
            is_dayloop = (
                name == "node.exe"
                and "vite" in command
                and root in command
                and page is not None
                and "/@vite/client" in page
            )

        if not is_dayloop:
            raise RuntimeError(
                f"Port {port} is already used by another application (PID {pid}). "
                "DayLoop left that process untouched."
            )
        _stop_tree(pid)

    deadline = time.time() + 5
    while time.time() < deadline and _listener_pids(port):
        time.sleep(0.15)
    if _listener_pids(port):
        raise RuntimeError(f"DayLoop could not release port {port}.")


def vite_command() -> list[str]:
    node = shutil.which("node")
    vite = ROOT / "node_modules" / "vite" / "bin" / "vite.js"
    if not node or not vite.is_file():
        raise RuntimeError("Install Node.js and run npm ci from the repository root.")
    return [node, str(vite), "--host", WEB_HOST, "--port", str(WEB_PORT), "--strictPort"]


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    if os.name == "nt":
        _clear_dayloop_port(API_PORT, "api")
        _clear_dayloop_port(WEB_PORT, "web")

    import uvicorn
    from app.db.migrate import apply_migrations
    from app.main import app
    from app.worker import process_due_notifications

    applied = apply_migrations()
    if applied:
        LOG.info("Applied pending database migrations: %s", ", ".join(applied))
    else:
        LOG.info("Database schema is up to date.")

    server = uvicorn.Server(uvicorn.Config(app, host=API_HOST, port=API_PORT))
    frontend_process = subprocess.Popen(
        vite_command(),
        cwd=FRONTEND,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    stopping = threading.Event()

    def watch_frontend() -> None:
        assert frontend_process.stdout is not None
        for line in frontend_process.stdout:
            print(f"[frontend] {line}", end="", flush=True)
        if not stopping.is_set():
            server.should_exit = True

    def run_notifications() -> None:
        # The development launcher owns the local in-app reminder worker so
        # API, frontend and reminder delivery all share one terminal lifecycle.
        stopping.wait(2)
        while not stopping.is_set():
            processed = 0
            try:
                processed = process_due_notifications()
                if processed:
                    LOG.info("Delivered %s in-app reminder%s.", processed, "" if processed == 1 else "s")
            except Exception:
                LOG.exception("Notification worker failed; retrying.")
            stopping.wait(1 if processed else 5)

    threading.Thread(target=watch_frontend, daemon=True).start()
    threading.Thread(target=run_notifications, daemon=True, name="dayloop-notifications").start()

    try:
        LOG.info("DayLoop API: http://%s:%s", API_HOST, API_PORT)
        LOG.info("DayLoop frontend: http://%s:%s", WEB_HOST, WEB_PORT)
        LOG.info("API docs: http://%s:%s/docs", API_HOST, API_PORT)
        LOG.info("Press Ctrl+C once to stop both services.")
        server.run()
        if frontend_process.poll() not in (None, 0):
            raise RuntimeError("Vite stopped unexpectedly. Check the frontend log above.")
    finally:
        stopping.set()
        if frontend_process.poll() is None:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill.exe", "/PID", str(frontend_process.pid), "/T", "/F"],
                    capture_output=True, text=True, check=False,
                )
            else:
                frontend_process.terminate()
            try:
                frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                frontend_process.kill()
        LOG.info("DayLoop development services stopped.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[dayloop] Shutdown requested.", flush=True)
    except Exception as error:
        print(f"\n[dayloop] {error}", file=sys.stderr, flush=True)
        raise
