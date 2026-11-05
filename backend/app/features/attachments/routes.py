import hashlib
import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/attachments", tags=["attachments"])
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def get_storage_root() -> Path:
    configured = Path(get_settings()["attachment_root"])
    root = configured if configured.is_absolute() else Path.cwd() / configured
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def resolve_storage_path(relative_path: str) -> Path:
    root = get_storage_root()
    target = (root / relative_path).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Attachment not found.") from error
    return target


@router.get("")
def list_attachments(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT id,original_name,mime_type,size_bytes,source_type,source_id,created_at "
            "FROM attachments WHERE user_id=%s AND deleted_at IS NULL ORDER BY created_at DESC",
            (user["id"],),
        )
    }


@router.post("", status_code=201)
async def upload_attachment(
    file: UploadFile = File(...), user: dict = Depends(get_current_user)
) -> dict:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="This file type is not supported.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Attachments must be between 1 byte and 10 MB.")
    attachment_id = uuid4()
    relative_path = str(Path(str(user["id"])) / str(attachment_id))
    target = resolve_storage_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    original_name = Path(file.filename or "attachment").name[:255]
    try:
        item = fetch_one(
            "INSERT INTO attachments (id,user_id,original_name,storage_path,mime_type,size_bytes,checksum_sha256) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id,original_name,mime_type,size_bytes,created_at",
            (
                attachment_id,
                user["id"],
                original_name,
                relative_path,
                file.content_type,
                len(content),
                hashlib.sha256(content).hexdigest(),
            ),
        )
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return {"item": item}


@router.get("/{attachment_id}")
def download_attachment(attachment_id: str, user: dict = Depends(get_current_user)) -> FileResponse:
    item = fetch_one(
        "SELECT original_name,storage_path,mime_type FROM attachments "
        "WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (attachment_id, user["id"]),
    )
    if not item:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    target = resolve_storage_path(item["storage_path"])
    if not target.is_file():
        raise HTTPException(
            status_code=404, detail="Attachment file is missing from local storage."
        )
    return FileResponse(target, media_type=item["mime_type"], filename=item["original_name"])


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: str, user: dict = Depends(get_current_user)) -> Response:
    item = fetch_one(
        "UPDATE attachments SET deleted_at=now() WHERE id=%s AND user_id=%s "
        "AND deleted_at IS NULL RETURNING storage_path",
        (attachment_id, user["id"]),
    )
    if not item:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    target = resolve_storage_path(item["storage_path"])
    if target.is_file():
        os.remove(target)
    return Response(status_code=204)
