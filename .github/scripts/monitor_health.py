"""One daily health check; bounded cold-start retries and no database writes."""

import json
import os
import sys
import time
import urllib.error
import urllib.request


def get_json(url: str, headers: dict[str, str] | None = None) -> dict:
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def previous_failures() -> int:
    repository = os.getenv("GITHUB_REPOSITORY", "")
    token = os.getenv("GH_TOKEN", "")
    if not repository or not token:
        return 0
    url = f"https://api.github.com/repos/{repository}/actions/workflows/dayloop-health.yml/runs?per_page=10&status=completed"
    try:
        runs = get_json(url, {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})["workflow_runs"]
    except (OSError, ValueError, KeyError):
        return 0
    count = 0
    for run in runs:
        if run.get("conclusion") != "failure":
            break
        count += 1
    return count


def main() -> int:
    base = os.getenv("DAYLOOP_HEALTH_BASE_URL", "").rstrip("/")
    key = os.getenv("DAYLOOP_ADMIN_KEY", "")
    if not base.startswith("https://") or not base.endswith("/api/v1") or not key:
        print("::error::Set DAYLOOP_API_URL to the public HTTPS API URL and DAYLOOP_ADMIN_KEY to the backend admin key.")
        return 1
    last_error = ""
    for attempt in range(3):
        try:
            health = get_json(base + "/health")
            if health.get("status") != "ok":
                raise ValueError("Health endpoint returned an unexpected status")
            ready = get_json(base + "/health/ready", {"X-DayLoop-Admin-Key": key})
            if ready.get("status") != "ready":
                raise ValueError("Database readiness endpoint returned an unexpected status")
            threshold = os.getenv("DAYLOOP_DB_WARN_BYTES", "")
            size = ready.get("database", {}).get("size_bytes", 0)
            if threshold and int(size) >= int(threshold):
                print(f"::warning::Database size {size} bytes exceeds configured warning threshold {threshold} bytes.")
            print("Backend and database ready.")
            return 0
        except (OSError, ValueError, urllib.error.HTTPError) as error:
            last_error = str(error)
            if attempt < 2:
                print(f"Health attempt {attempt + 1} failed; allowing one cold-start interval.")
                time.sleep(30)
    count = previous_failures() + 1
    print(f"::error::Backend/database unavailable after 3 bounded attempts; consecutive failed runs: {count}. Last error: {last_error}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
