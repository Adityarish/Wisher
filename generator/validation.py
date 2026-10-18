from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def validate_content(content: dict[str, Any], registry: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings = list(content.get("_warnings", []))
    ids = {entry["id"] for entry in registry}
    if content.get("template_id") not in ids:
        errors.append(f"Unknown template ID {content.get('template_id')}. Run --list to see available templates.")
    if not str(content.get("title", "")).strip() and not str(content.get("message", "")).strip():
        errors.append("Add at least a title or main message.")
    if not content.get("recipient_names"):
        warnings.append("No recipient name is set; the design will use a neutral greeting.")
    project_dir: Path = content["_project_dir"]
    referenced: list[tuple[str, str | None]] = [
        ("hero image", content.get("media", {}).get("hero")),
        ("background music", content.get("media", {}).get("background_music")),
        ("social preview", content.get("media", {}).get("social_preview")),
    ]
    for field in ("gallery", "videos", "voice_messages"):
        referenced.extend((field, item.get("src")) for item in content.get(field, []))
    for label, relative in referenced:
        if relative and not (project_dir / relative).is_file():
            errors.append(f"Missing {label}: {relative}")
    for event in content.get("events", []):
        for link_name in ("map_url", "rsvp_url"):
            link = event.get(link_name)
            if link and urlparse(link).scheme not in {"http", "https"}:
                errors.append(f"Event {link_name} must be an http(s) URL.")
    if content.get("event_datetime") and not content.get("timezone"):
        warnings.append("A date is set without a timezone.")
    for kind, files in content.get("_discovered", {}).items():
        for relative in files:
            size = (project_dir / relative).stat().st_size
            if kind == "videos" and size > 80 * 1024 * 1024:
                warnings.append(f"Large video may load slowly ({size // 1024 // 1024} MB): {relative}")
            if kind == "audios" and size > 20 * 1024 * 1024:
                warnings.append(f"Large audio may load slowly ({size // 1024 // 1024} MB): {relative}")
    return errors, warnings

