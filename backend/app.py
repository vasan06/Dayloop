from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOCAL_PYTHON = HERE / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run_with_local_environment() -> None:
    if not LOCAL_PYTHON.is_file() or sys.prefix != sys.base_prefix:
        return
    command = [str(LOCAL_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]]
    raise SystemExit(subprocess.call(command, cwd=HERE.parent))


if __name__ == "__main__":
    run_with_local_environment()

from dev import main


if __name__ == "__main__":
    main()
