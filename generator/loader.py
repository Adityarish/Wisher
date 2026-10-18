from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

SUPPORTED_MEDIA = {
    "photos": {".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg"},
    "videos": {".mp4", ".webm", ".ogv"},
    "audios": {".mp3", ".m4a", ".ogg", ".wav"},
    "gifs": {".gif", ".webp", ".png", ".svg"},
    "stickers": {".gif", ".webp", ".png", ".svg"},
}
TEXT_FIELDS = ("title", "subtitle", "message", "letter", "closing")
VOICE_RE = re.compile(r"^(\d+[\s._-]*)?voice", re.I)

DEFAULT_CONTENT: dict[str, Any] = {
    "project_slug": "",
    "occasion": "custom",
    "template_id": 1,
    "recipient_names": ["Someone special"],
    "sender_name": "",
    "relationship": "",
    "language": "en",
    "title": "A little surprise for you",
    "subtitle": "Made with care, just for you",
    "message": "You make ordinary moments feel worth celebrating.",
    "closing_message": "With warm wishes for everything ahead.",
    "age_or_milestone": None,
    "event_datetime": None,
    "timezone": "Asia/Kolkata",
    "events": [],
    "gallery": [],
    "videos": [],
    "voice_messages": [],
    "timeline": [],
    "memory_cards": [],
    "appreciation_cards": [],
    "quotes": [],
    "letter": "",
    "reveal_message": "Here is to the beautiful moments still to come.",
    "button_labels": {"open": "Open your surprise", "reveal": "Make a wish", "letter": "Read the letter"},
    "theme": {
        "palette": "default",
        "accent_color": "",
        "font_pairing": "expressive",
        "appearance": "auto",
        "animation_intensity": "subtle",
        "decoration_density": "medium",
    },
    "media": {"hero": None, "background_music": None, "social_preview": None, "hero_focal_position": "50% 50%"},
    "gif_roles": {},
    "sticker_roles": {},
    "sections": ["hero", "gallery", "letter", "surprise", "closing"],
    "section_options": {},
    "opening_interaction": "default",
    "music_enabled": True,
    "countdown_enabled": False,
    "branding_credit": False,
    "gif_theme": "auto",
    "gif_pack_size": 8,
    "wow_effects": True,
    "reasons": [],
    "reasons_count": 100,
    "reasons_fill_defaults": True,
    "love_letter_animation": True,
    "intro_splash": True,
    "site_nav": True,
    "share_enabled": True,
    "love_particles": "auto",
    "collage_layout": {},
    "edit_mode_button": True,
    "gif_rail": True,
}


class ContentError(ValueError):
    pass


def natural_key(value: str | Path) -> list[Any]:
    return [int(piece) if piece.isdigit() else piece.casefold() for piece in re.split(r"(\d+)", str(value))]


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return slug or "my-wish"


def _export_name(root: Path, template_id: int, project: str, explicit: Any) -> str:
    """Folder name under dist/. A hand-written project_slug wins; otherwise it is the invitation type
    (for example "wedding-invitation"), with the project name added when it is not "default"."""
    if str(explicit or "").strip():
        return slugify(str(explicit))
    template = next((item for item in load_registry(root) if item["id"] == template_id), None)
    kind = slugify(template["name"]) if template else "my-wish"
    return kind if project == "default" else f"{kind}-{slugify(project)}"


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value
    return result


def _safe_relative(project_dir: Path, value: str | None, label: str) -> str | None:
    if not value:
        return None
    candidate = Path(value)
    if candidate.is_absolute():
        raise ContentError(f"{label} must be relative to the project folder: {value}")
    resolved = (project_dir / candidate).resolve()
    try:
        resolved.relative_to(project_dir.resolve())
    except ValueError as exc:
        raise ContentError(f"{label} escapes the project folder: {value}") from exc
    return candidate.as_posix()


def caption_from_filename(name: str) -> str:
    """'03_our-first-trip.jpg' -> 'Our first trip'. Generic names such as 'photo' or 'hero' give no caption."""
    stem = re.sub(r"^\d+[\s._-]*", "", Path(name).stem)
    stem = re.sub(r"^(hero|cover)[\s._-]*", "", stem, flags=re.I)
    text = re.sub(r"[-_]+", " ", stem).strip()
    if not text or text.casefold() in {"photo", "image", "img", "video", "clip", "memory"} or len(text) > 70:
        return ""
    return text[:1].upper() + text[1:]


def discover_media(project_dir: Path) -> tuple[dict[str, list[str]], list[str]]:
    discovered: dict[str, list[str]] = {}
    warnings: list[str] = []
    for kind, extensions in SUPPORTED_MEDIA.items():
        folder = project_dir / kind
        items: list[str] = []
        if folder.exists():
            for path in sorted((p for p in folder.iterdir() if p.is_file()), key=lambda p: natural_key(p.name)):
                if path.is_symlink():
                    warnings.append(f"Symbolic link skipped for safety: {kind}/{path.name}")
                    continue
                if path.suffix.lower() in extensions:
                    items.append(path.relative_to(project_dir).as_posix())
                elif not path.name.startswith(".") and path.name != ".gitkeep":
                    warnings.append(f"Unsupported {kind[:-1]} file skipped: {path.name}")
        discovered[kind] = items
    return discovered, warnings


def _read_text_fallbacks(project_dir: Path, raw: dict[str, Any]) -> dict[str, Any]:
    updated = dict(raw)
    text_dir = project_dir / "texts"
    for field in TEXT_FIELDS:
        json_key = "closing_message" if field == "closing" else field
        if updated.get(json_key) not in (None, ""):
            continue
        path = text_dir / f"{field}.txt"
        if path.is_file():
            updated[json_key] = path.read_text(encoding="utf-8").strip()
    reasons_file = text_dir / "reasons.txt"
    if not updated.get("reasons") and reasons_file.is_file():
        updated["reasons"] = [line.strip() for line in reasons_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    quotes_file = text_dir / "quotes.txt"
    if not updated.get("quotes") and quotes_file.is_file():
        quotes = []
        for line in quotes_file.read_text(encoding="utf-8").splitlines():
            if line.strip():
                text, _, author = line.partition("|")
                quotes.append({"text": text.strip(), "author": author.strip()})
        updated["quotes"] = quotes
    return updated


def _normalize_cards(content: dict[str, Any], project_dir: Path) -> None:
    for field, asset_key in (("gallery", "src"), ("videos", "src"), ("voice_messages", "src")):
        cleaned = []
        for index, item in enumerate(content.get(field) or []):
            entry = {asset_key: item} if isinstance(item, str) else dict(item)
            if entry.get(asset_key):
                entry[asset_key] = _safe_relative(project_dir, entry[asset_key], f"{field}[{index}]")
                cleaned.append(entry)
        content[field] = cleaned


def load_registry(root: Path) -> list[dict[str, Any]]:
    path = root / "templates" / "registry.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContentError(f"Could not load template registry: {exc}") from exc
    templates = data.get("templates") if isinstance(data, dict) else None
    if not isinstance(templates, list):
        raise ContentError("Template registry must contain a 'templates' list.")
    return templates


def load_project(root: Path, project: str = "default", template_override: int | None = None) -> dict[str, Any]:
    content_root = (root / "content").resolve()
    project_dir = (content_root / project).resolve()
    try:
        project_dir.relative_to(content_root)
    except ValueError as exc:
        raise ContentError("Project name must stay inside content/.") from exc
    if not project_dir.is_dir():
        raise ContentError(f"Project folder does not exist: content/{project}")
    config_path = project_dir / "content.json"
    if config_path.exists():
        try:
            raw = json.loads(config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ContentError(f"Malformed JSON in {config_path}: line {exc.lineno}, column {exc.colno}") from exc
        if not isinstance(raw, dict):
            raise ContentError("content.json must contain a JSON object.")
    else:
        raw = {}
    raw = _read_text_fallbacks(project_dir, raw)
    content = _merge(DEFAULT_CONTENT, raw)
    if template_override is not None:
        content["template_id"] = template_override
    try:
        content["template_id"] = int(content["template_id"])
    except (TypeError, ValueError) as exc:
        raise ContentError("template_id must be a number.") from exc
    content["project_slug"] = _export_name(root, content["template_id"], project, content.get("project_slug"))
    content["recipient_names"] = [str(value) for value in (content.get("recipient_names") or []) if str(value).strip()]
    discovered, warnings = discover_media(project_dir)
    content["_discovered"] = discovered
    content["_warnings"] = warnings
    content["_project_name"] = project
    content["_project_dir"] = project_dir

    media = content.setdefault("media", {})
    named_hero = next((p for p in discovered["photos"] if re.match(r"(\d+[\s._-]*)?(hero|cover)", Path(p).stem, re.I)), None)
    media["hero"] = _safe_relative(project_dir, media.get("hero"), "media.hero") or named_hero or (discovered["photos"][0] if discovered["photos"] else None)
    songs = [a for a in discovered["audios"] if not VOICE_RE.match(Path(a).stem)]
    media["background_music"] = _safe_relative(project_dir, media.get("background_music"), "media.background_music") or (songs[0] if songs else None)
    media["social_preview"] = _safe_relative(project_dir, media.get("social_preview"), "media.social_preview")
    _normalize_cards(content, project_dir)
    assigned_photos = {entry["src"] for entry in content["gallery"]}
    for photo in discovered["photos"]:
        if photo != media["hero"] and photo not in assigned_photos:
            content["gallery"].append({"src": photo, "caption": caption_from_filename(photo), "alt": caption_from_filename(photo) or "A shared memory"})
    assigned_videos = {entry["src"] for entry in content["videos"]}
    for video in discovered["videos"]:
        if video not in assigned_videos:
            content["videos"].append({"src": video, "caption": caption_from_filename(video)})
    assigned_voice = {entry["src"] for entry in content["voice_messages"]}
    for audio in discovered["audios"]:
        if VOICE_RE.match(Path(audio).stem) and audio not in assigned_voice:
            who = re.sub(r"^(\d+[\s._-]*)?voice[\s._-]*", "", Path(audio).stem, flags=re.I).replace("-", " ").replace("_", " ").strip()
            content["voice_messages"].append({"src": audio, "caption": f"A voice note from {who.title()}" if who else "A voice note for you"})
    for roles_key, folder in (("gif_roles", "gifs"), ("sticker_roles", "stickers")):
        roles = content.setdefault(roles_key, {})
        for role, value in list(roles.items()):
            roles[role] = _safe_relative(project_dir, value, f"{roles_key}.{role}")
        for index, path in enumerate(discovered[folder]):
            roles.setdefault("welcome" if index == 0 else f"extra_{index}", path)
    return content

