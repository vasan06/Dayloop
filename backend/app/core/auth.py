from __future__ import annotations

import time

import jwt
import requests
from cryptography import x509
from fastapi import Header, HTTPException, status

from app.core.config import get_settings

_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_CERT_CACHE: dict[str, object] = {"expires_at": 0.0, "certs": {}}


def _firebase_certs() -> dict[str, str]:
    now = time.time()
    certs = _CERT_CACHE.get("certs")
    if isinstance(certs, dict) and certs and now < float(_CERT_CACHE.get("expires_at", 0.0)):
        return certs
    response = requests.get(_CERTS_URL, timeout=5)
    response.raise_for_status()
    data = response.json()
    max_age = 300
    cache_control = response.headers.get("Cache-Control", "")
    for part in cache_control.split(","):
        part = part.strip()
        if part.startswith("max-age="):
            try:
                max_age = max(60, int(part.split("=", 1)[1]))
            except ValueError:
                pass
    _CERT_CACHE["certs"] = data
    _CERT_CACHE["expires_at"] = now + max_age
    return data


def verify_firebase_id_token(token: str) -> dict:
    project_id = get_settings()["firebase_project_id"]
    if not project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID is required for Firebase authentication.")
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "RS256":
        raise ValueError("Firebase ID token must use RS256.")
    kid = header.get("kid")
    if not kid:
        raise ValueError("Firebase ID token is missing a key ID.")
    cert = _firebase_certs().get(kid)
    if not cert:
        _CERT_CACHE["expires_at"] = 0.0
        cert = _firebase_certs().get(kid)
    if not cert:
        raise ValueError("Firebase signing key was not found.")

    # Google publishes X.509 certificates, not bare public keys.
    # PyJWT needs the public key extracted from the certificate.
    public_key = x509.load_pem_x509_certificate(cert.encode("utf-8")).public_key()

    claims = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        audience=project_id,
        issuer=f"https://securetoken.google.com/{project_id}",
        options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        leeway=30,
    )
    subject = str(claims.get("sub") or "")
    if not subject or len(subject) > 128:
        raise ValueError("Firebase ID token subject is invalid.")
    claims["uid"] = subject
    return claims


def get_current_user(
    authorization: str | None = Header(default=None),
    x_dayloop_dev_user: str | None = Header(default=None),
    x_dayloop_dev_email: str | None = Header(default=None),
    x_dayloop_dev_name: str | None = Header(default=None),
) -> dict:
    settings = get_settings()
    if settings["auth_mode"] == "development" and settings["app_env"] == "development":
        if not x_dayloop_dev_user:
            raise HTTPException(status_code=401, detail="Local development identity is missing.")
        from app.core.database import fetch_one
        return fetch_one(
            "INSERT INTO users (firebase_uid,email,display_name) VALUES (%s,%s,%s) "
            "ON CONFLICT (firebase_uid) DO UPDATE SET "
            "email=COALESCE(EXCLUDED.email,users.email),"
            "display_name=COALESCE(users.display_name,EXCLUDED.display_name),updated_at=now() "
            "RETURNING id,firebase_uid",
            (
                f"local:{x_dayloop_dev_user}",
                x_dayloop_dev_email or f"{x_dayloop_dev_user}@local.dayloop",
                x_dayloop_dev_name or "Local DayLoop user",
            ),
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A Firebase ID token is required.",
        )
    try:
        claims = verify_firebase_id_token(authorization[7:])
    except Exception as error:
        detail = "The Firebase ID token is invalid or expired."
        if settings["app_env"] == "development":
            detail = f"{detail} ({type(error).__name__}: {error})"
        raise HTTPException(status_code=401, detail=detail) from error

    from app.core.database import fetch_one
    return fetch_one(
        "INSERT INTO users (firebase_uid,email,display_name) VALUES (%s,%s,%s) "
        "ON CONFLICT (firebase_uid) DO UPDATE SET email=EXCLUDED.email,"
        "display_name=COALESCE(users.display_name,EXCLUDED.display_name),updated_at=now() "
        "RETURNING id,firebase_uid",
        (claims["uid"], claims.get("email"), claims.get("name")),
    )