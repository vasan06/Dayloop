import json

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one, get_connection

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("")
def get_pages(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT id,parent_page_id,title,icon,position,is_favorite,created_at,updated_at "
            "FROM note_pages WHERE user_id=%s AND deleted_at IS NULL AND archived_at IS NULL "
            "ORDER BY position,title",
            (user["id"],),
        )
    }


@router.post("", status_code=201)
def create_page(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    title = str(payload.get("title", "Untitled")).strip() or "Untitled"
    if len(title) > 240:
        raise HTTPException(status_code=422, detail="Page title is too long.")
    parent_id = payload.get("parent_page_id")
    if parent_id and not fetch_one(
        "SELECT id FROM note_pages WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (parent_id, user["id"]),
    ):
        raise HTTPException(status_code=404, detail="Parent page not found.")
    page = fetch_one(
        "INSERT INTO note_pages (user_id,parent_page_id,title,icon) VALUES (%s,%s,%s,%s) RETURNING *",
        (user["id"], parent_id, title, payload.get("icon")),
    )
    return {"item": page}


@router.get("/{page_id}")
def get_page(page_id: str, user: dict = Depends(get_current_user)) -> dict:
    page = fetch_one(
        "SELECT * FROM note_pages WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (page_id, user["id"]),
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found.")
    blocks = fetch_all(
        "SELECT id,parent_block_id,block_type,content,position,updated_at FROM note_blocks "
        "WHERE page_id=%s ORDER BY position",
        (page_id,),
    )
    return {"item": page, "blocks": blocks}


@router.put("/{page_id}/blocks")
def save_blocks(page_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    blocks = payload.get("blocks", [])
    if not isinstance(blocks, list) or len(blocks) > 1000:
        raise HTTPException(status_code=422, detail="Blocks must be a list of at most 1000 items.")
    if not fetch_one(
        "SELECT id FROM note_pages WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (page_id, user["id"]),
    ):
        raise HTTPException(status_code=404, detail="Page not found.")
    allowed_types = {
        "paragraph",
        "heading",
        "bulleted_list",
        "numbered_list",
        "todo",
        "quote",
        "callout",
        "code",
        "divider",
    }
    with get_connection() as connection:
        connection.execute("DELETE FROM note_blocks WHERE page_id=%s", (page_id,))
        for position, block in enumerate(blocks):
            block_type = block.get("type", "paragraph")
            if block_type not in allowed_types:
                raise HTTPException(status_code=422, detail=f"Unsupported block type: {block_type}")
            connection.execute(
                "INSERT INTO note_blocks (page_id,block_type,content,position) "
                "VALUES (%s,%s,%s::jsonb,%s)",
                (page_id, block_type, json.dumps(block.get("content", {})), position),
            )
        connection.execute("UPDATE note_pages SET updated_at=now() WHERE id=%s", (page_id,))
    return {"saved": len(blocks)}


@router.patch("/{page_id}")
def update_page(page_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    title = str(payload.get("title", "")).strip()
    if not title or len(title) > 240:
        raise HTTPException(
            status_code=422, detail="Page title is required (maximum 240 characters)."
        )
    page = fetch_one(
        "UPDATE note_pages SET title=%s,updated_at=now() WHERE id=%s AND user_id=%s "
        "AND deleted_at IS NULL RETURNING *",
        (title, page_id, user["id"]),
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found.")
    return {"item": page}


@router.delete("/{page_id}", status_code=204)
def delete_page(page_id: str, user: dict = Depends(get_current_user)) -> Response:
    page = fetch_one(
        "UPDATE note_pages SET deleted_at=now(),updated_at=now() WHERE id=%s AND user_id=%s "
        "AND deleted_at IS NULL RETURNING id",
        (page_id, user["id"]),
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found.")
    return Response(status_code=204)
