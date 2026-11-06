import logging
import os

import uvicorn

from app.main import app


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    uvicorn.run(
        app,
        host=os.getenv("DAYLOOP_HOST", "127.0.0.1"),
        port=int(os.getenv("DAYLOOP_PORT", "8000")),
        log_level="info",
        access_log=True,
        reload=False,
    )


if __name__ == "__main__":
    main()
