from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .reasons import build_reasons
from .loader import ContentError, load_project, load_registry
from .validation import validate_content


class GenerationError(RuntimeError):
    pass


def _asset_url(relative: str | None) -> str | None:
    return f"assets/content/{relative}" if relative else None


def _copy_referenced_assets(content: dict[str, Any], output_assets: Path) -> None:
    project_dir: Path = content["_project_dir"]
    target_root = output_assets / "content"
    for files in content["_discovered"].values():
        for relative in files:
            source = project_dir / relative
            target = target_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def _public_content(content: dict[str, Any]) -> dict[str, Any]:
    public = {key: value for key, value in content.items() if not key.startswith("_")}
    public["media"] = dict(public.get("media", {}))
    for key in ("hero", "background_music", "social_preview"):
        public["media"][key] = _asset_url(public["media"].get(key))
    for field in ("gallery", "videos", "voice_messages"):
        public[field] = [{**item, "src": _asset_url(item.get("src"))} for item in public.get(field, [])]
    for field in ("gif_roles", "sticker_roles"):
        public[field] = {role: _asset_url(path) for role, path in public.get(field, {}).items() if path}
    return public


GIF_THEME_BY_OCCASION = {
    "birthday": "03_Birthday_Wishes", "anniversary": "06_Wedding_Anniversary", "wedding": "06_Wedding_Anniversary",
    "romantic": "01_Love_Romance", "love": "01_Love_Romance", "friendship": "07_Friendship_Hugs",
    "thank": "08_Thank_You", "congrat": "09_Congratulations", "festival": "10_Celebration_Confetti",
}
def _clean_layout(raw: Any) -> dict[str, dict[str, int]]:
    """Keep only {key: {c: 1-6, r: 1-8}} so a hand-edited content.json cannot inject markup."""
    clean: dict[str, dict[str, int]] = {}
    if isinstance(raw, dict):
        for key, size in raw.items():
            if isinstance(size, dict):
                try:
                    clean[str(key)] = {"c": max(1, min(6, int(size.get("c", 1)))), "r": max(1, min(8, int(size.get("r", 1))))}
                except (TypeError, ValueError):
                    continue
    return clean


GIF_PACK_MAX_BYTES = 2 * 1024 * 1024


def _resolve_gif_theme(root: Path, requested: str, occasion_label: str) -> Path | None:
    library = root / "WishCraft_GIF_Collection"
    if not library.is_dir():
        return None
    folders = {p.name.casefold(): p for p in library.iterdir() if p.is_dir()}
    wanted = str(requested or "auto").strip().casefold()
    if wanted in ("none", "off", "false"):
        return None
    if wanted != "auto":
        if wanted in folders:
            return folders[wanted]
        match = next((p for name, p in sorted(folders.items()) if wanted.replace(" ", "_") in name), None)
        if match:
            return match
    label = occasion_label.casefold()
    name = next((v for k, v in GIF_THEME_BY_OCCASION.items() if k in label), "10_Celebration_Confetti")
    return folders.get(name.casefold())


def _copy_gif_pack(root: Path, content: dict[str, Any], template_meta: dict[str, Any], output_assets: Path) -> list[str]:
    """Copy a handful of GIFs from WishCraft_GIF_Collection for floating stickers and collage tiles."""
    theme = _resolve_gif_theme(root, content.get("gif_theme", "auto"), template_meta.get("occasion_label", ""))
    if theme is None:
        return []
    limit = max(0, min(int(content.get("gif_pack_size") or 8), 12))
    picked = [p for p in sorted(theme.glob("*.gif")) if p.stat().st_size <= GIF_PACK_MAX_BYTES][:limit]
    target = output_assets / "content" / "gif_pack"
    urls = []
    for source in picked:
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target / source.name)
        urls.append(f"assets/content/gif_pack/{source.name}")
    return urls


def generate_site(
    root: Path,
    project: str = "default",
    template_override: int | None = None,
    overwrite: bool = False,
) -> dict[str, Any]:
    root = root.resolve()
    registry = load_registry(root)
    content = load_project(root, project, template_override)
    errors, warnings = validate_content(content, registry)
    if errors:
        raise GenerationError("\n".join(errors))
    template_meta = next(item for item in registry if item["id"] == content["template_id"])
    output_dir = root / "dist" / content["project_slug"]
    if output_dir.exists():
        if not overwrite:
            raise GenerationError(f"Output already exists: {output_dir}. Re-run with --overwrite to replace it.")
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    assets = output_dir / "assets"
    shutil.copytree(root / "shared", assets / "shared")
    template_dir = root / "templates" / template_meta["directory"]
    if (template_dir / "assets").is_dir():
        shutil.copytree(template_dir / "assets", assets / "template")
    _copy_referenced_assets(content, assets)
    gif_pack = _copy_gif_pack(root, content, template_meta, assets)

    env = Environment(
        loader=FileSystemLoader([str(template_dir), str(root / "templates")]),
        autoescape=select_autoescape(("html", "xml")),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["asset"] = _asset_url
    public = _public_content(content)
    user_gifs = [url for url in public.get("gif_roles", {}).values() if url and not url.endswith(".svg")]
    public["gif_pack"] = user_gifs + gif_pack
    public["reasons"] = build_reasons(content.get("reasons") or [], int(content.get("reasons_count") or 0), bool(content.get("reasons_fill_defaults", True)))
    label = template_meta.get("occasion_label", "").casefold()
    particles = str(content.get("love_particles", "auto")).casefold()
    if particles == "auto":
        particles = "hearts" if any(k in label for k in ("love", "romantic", "anniversary", "wedding")) else "confetti"
    public["particles"] = particles
    public["project_name"] = project
    public["collage_layout"] = _clean_layout(content.get("collage_layout"))
    public["love_mode"] = particles == "hearts"
    public["envelope"] = public["love_mode"] and bool(content.get("love_letter_animation", True))
    if not content.get("reasons"):
        public["reasons"] = build_reasons([c.get("text", c) if isinstance(c, dict) else c for c in content.get("appreciation_cards") or []], int(content.get("reasons_count") or 0), bool(content.get("reasons_fill_defaults", True)))
    rendered = env.get_template("template.html").render(content=public, template=template_meta)
    (output_dir / "index.html").write_text(rendered, encoding="utf-8")
    manifest = {
        "generator": "WishCraft",
        "project": project,
        "slug": content["project_slug"],
        "template_id": template_meta["id"],
        "template_name": template_meta["name"],
        "warnings": warnings,
    }
    (output_dir / "wishcraft-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"output_dir": output_dir, "content": content, "template": template_meta, "warnings": warnings}

