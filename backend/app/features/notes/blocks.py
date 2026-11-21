from fastapi import HTTPException

BLOCK_TYPES = {
    "paragraph", "heading", "heading_1", "heading_2", "heading_3", "heading_4",
    "heading_5", "heading_6", "bulleted_list", "numbered_list", "todo", "quote",
    "callout", "code", "divider", "checkbox", "progress", "toggle", "page", "columns",
}


def validated_blocks(payload: dict) -> list[dict]:
    blocks = payload.get("blocks")
    if not isinstance(blocks, list) or len(blocks) > 1000:
        raise HTTPException(422, "Provide a list of up to 1000 note blocks.")
    output = []
    for index, block in enumerate(blocks, start=1):
        if not isinstance(block, dict):
            raise HTTPException(422, f"Block {index} must be an object.")
        kind = block.get("type", block.get("block_type", "paragraph"))
        content = block.get("content", {})
        if not isinstance(kind, str) or kind not in BLOCK_TYPES or not isinstance(content, dict):
            raise HTTPException(422, f"Block {index} has an invalid type or content.")
        if any(key in content and not isinstance(content[key], str) for key in ("text", "details")):
            raise HTTPException(422, f"Block {index} text must be a string.")
        if "columns" in content and (
            not isinstance(content["columns"], list) or len(content["columns"]) != 2
            or any(not isinstance(column, str) for column in content["columns"])
        ):
            raise HTTPException(422, f"Block {index} must contain two text columns.")
        if "checked" in content and not isinstance(content["checked"], bool):
            raise HTTPException(422, f"Block {index} checkbox state must be true or false.")
        output.append({**block, "type": kind, "content": content})
    return output
