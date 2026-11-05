from functools import lru_cache

from fastapi import Header, HTTPException, status

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_firebase_app():
    import firebase_admin
    from firebase_admin import credentials

    project_id = get_settings()["firebase_project_id"]
    if not project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID is required for Firebase authentication.")
    try:
        return firebase_admin.get_app()
    except ValueError:
        return firebase_admin.initialize_app(
            credentials.ApplicationDefault(), {"projectId": project_id}
        )


def get_current_user(
    authorization: str | None = Header(default=None),
    x_dayloop_dev_user: str | None = Header(default=None),
) -> dict:
    settings = get_settings()
    if settings["auth_mode"] == "development" and settings["app_env"] != "production":
        if not x_dayloop_dev_user:
            raise HTTPException(status_code=401, detail="Local development identity is missing.")
        from app.core.database import fetch_one

        return fetch_one(
            "INSERT INTO users (firebase_uid,email,display_name) VALUES (%s,%s,%s) "
            "ON CONFLICT (firebase_uid) DO UPDATE SET updated_at=now() RETURNING id,firebase_uid",
            (
                f"local:{x_dayloop_dev_user}",
                f"{x_dayloop_dev_user}@local.dayloop",
                "Local DayLoop user",
            ),
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="A Firebase ID token is required."
        )
    try:
        from firebase_admin import auth

        claims = auth.verify_id_token(authorization[7:], app=get_firebase_app())
    except Exception as error:
        raise HTTPException(
            status_code=401, detail="The Firebase ID token is invalid or expired."
        ) from error
    from app.core.database import fetch_one

    return fetch_one(
        "INSERT INTO users (firebase_uid,email,display_name) VALUES (%s,%s,%s) "
        "ON CONFLICT (firebase_uid) DO UPDATE SET email=EXCLUDED.email,"
        "display_name=COALESCE(EXCLUDED.display_name,users.display_name),updated_at=now() "
        "RETURNING id,firebase_uid",
        (claims["uid"], claims.get("email"), claims.get("name")),
    )
