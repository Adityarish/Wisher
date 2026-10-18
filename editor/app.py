from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path
from typing import Any

from flask import Flask, abort, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

from generator.engine import GenerationError, generate_site
from generator.organizer import CONVENTION_ROWS, organize
from generator.loader import ContentError, SUPPORTED_MEDIA, load_project, load_registry
from generator.validation import validate_content

PROJECT_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")


def create_app(root: Path) -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.update(MAX_CONTENT_LENGTH=120 * 1024 * 1024, JSON_AS_ASCII=False)
    root = root.resolve()
    content_root = root / "content"
    dist_root = root / "dist"

    def project_dir(project: str) -> Path:
        if not PROJECT_RE.fullmatch(project):
            abort(400, description="Use only letters, numbers, hyphens, and underscores in project names.")
        return content_root / project

    def public_content(content: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in content.items() if not key.startswith("_")}

    def ordered_media(content: dict[str, Any]) -> dict[str, list[str]]:
        media = {kind: list(paths) for kind, paths in content["_discovered"].items()}
        preferred = {
            "photos": [content.get("media", {}).get("hero"), *(item.get("src") for item in content.get("gallery", []))],
            "videos": [item.get("src") for item in content.get("videos", [])],
            "audios": [content.get("media", {}).get("background_music"), *(item.get("src") for item in content.get("voice_messages", []))],
        }
        for kind, paths in preferred.items():
            ordered = [path for path in paths if path and path in media[kind]]
            media[kind] = list(dict.fromkeys([*ordered, *media[kind]]))
        return media

    @app.get("/")
    def index():
        projects = sorted(path.name for path in content_root.iterdir() if path.is_dir() and PROJECT_RE.fullmatch(path.name))
        return render_template("editor.html", templates=load_registry(root), projects=projects or ["default"], convention=CONVENTION_ROWS)

    @app.get("/api/templates")
    def templates_api():
        return jsonify(load_registry(root))

    @app.get("/api/projects")
    def projects_api():
        projects = sorted(path.name for path in content_root.iterdir() if path.is_dir() and PROJECT_RE.fullmatch(path.name))
        return jsonify(projects)

    @app.get("/api/projects/<project>")
    def load_project_api(project: str):
        project_dir(project)
        try:
            content = load_project(root, project)
            errors, warnings = validate_content(content, load_registry(root))
            return jsonify({"content": public_content(content), "media": ordered_media(content), "errors": errors, "warnings": warnings})
        except ContentError as exc:
            return jsonify({"error": str(exc)}), 404

    @app.post("/api/projects/<project>/save")
    def save_project_api(project: str):
        folder = project_dir(project)
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Expected a JSON content object."}), 400
        for key in list(payload):
            if key.startswith("_"):
                payload.pop(key)
        folder.mkdir(parents=True, exist_ok=True)
        for media_folder in SUPPORTED_MEDIA:
            (folder / media_folder).mkdir(exist_ok=True)
        target = folder / "content.json"
        if target.exists():  # picture sizes come from the site's Edit mode, never from the studio form
            try:
                existing = json.loads(target.read_text(encoding="utf-8")).get("collage_layout")
            except (OSError, json.JSONDecodeError):
                existing = None
            if existing:
                payload["collage_layout"] = existing
            else:
                payload.pop("collage_layout", None)
        temporary = folder / ".content.json.tmp"
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(target)
        try:
            content = load_project(root, project)
            errors, warnings = validate_content(content, load_registry(root))
        except ContentError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"ok": True, "errors": errors, "warnings": warnings})

    @app.post("/api/projects/<project>/upload/<kind>")
    def upload_api(project: str, kind: str):
        folder = project_dir(project)
        if kind not in SUPPORTED_MEDIA:
            return jsonify({"error": f"Unknown media category: {kind}"}), 400
        files = request.files.getlist("files")
        if not files:
            return jsonify({"error": "Choose at least one file."}), 400
        destination = folder / kind
        destination.mkdir(parents=True, exist_ok=True)
        saved: list[str] = []
        rejected: list[str] = []
        for upload in files:
            filename = secure_filename(upload.filename or "")
            if not filename or Path(filename).suffix.lower() not in SUPPORTED_MEDIA[kind]:
                rejected.append(upload.filename or "unnamed file")
                continue
            target = destination / filename
            counter = 2
            while target.exists():
                target = destination / f"{Path(filename).stem}-{counter}{Path(filename).suffix.lower()}"
                counter += 1
            upload.save(target)
            saved.append(target.relative_to(folder).as_posix())
        return jsonify({"saved": saved, "rejected": rejected})

    @app.post("/api/projects/<project>/smart-upload")
    def smart_upload_api(project: str):
        """Accept any mix of files (or a whole folder) and file them using the naming convention."""
        folder = project_dir(project)
        uploads = request.files.getlist("files")
        if not uploads:
            return jsonify({"error": "Choose files or a folder first."}), 400
        dry_run = request.form.get("dry_run") == "1"
        hero = request.form.get("hero") or None
        with tempfile.TemporaryDirectory() as scratch:
            items = []
            for index, upload in enumerate(uploads):
                original = Path((upload.filename or "").replace("\\", "/")).name  # folder uploads send "dir/file.jpg"
                safe = secure_filename(original) or f"file-{index}"
                holder = Path(scratch) / str(index)
                holder.mkdir()
                path = holder / safe
                upload.save(path)
                items.append((original if Path(original).suffix else safe, path))
            results = organize(folder, items, hero=hero, dry_run=dry_run)
        added = [r for r in results if r.status == "added"]
        return jsonify({
            "dry_run": dry_run,
            "results": [r.__dict__ for r in results],
            "added": len(added),
            "skipped": len(results) - len(added),
        })

    @app.post("/api/projects/<project>/layout")
    def layout_api(project: str):
        """Save picture sizes chosen in the site's Edit mode into content.json (collage_layout)."""
        folder = project_dir(project)
        payload = request.get_json(silent=True)
        layout = payload.get("layout") if isinstance(payload, dict) else None
        if not isinstance(layout, dict):
            return jsonify({"error": "Expected {\"layout\": {...}}."}), 400
        clean: dict[str, dict[str, int]] = {}
        for key, size in layout.items():
            try:
                clean[str(key)[:300]] = {"c": max(1, min(6, int(size["c"]))), "r": max(1, min(8, int(size["r"])))}
            except (KeyError, TypeError, ValueError):
                continue
        target = folder / "content.json"
        data = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
        data["collage_layout"] = clean
        folder.mkdir(parents=True, exist_ok=True)
        tmp = folder / ".content.json.tmp"
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(target)
        return jsonify({"ok": True, "saved": len(clean)})

    @app.post("/api/projects/<project>/generate")
    def generate_api(project: str):
        project_dir(project)
        try:
            result = generate_site(root, project, overwrite=True)
            return jsonify({"ok": True, "preview_url": f"/preview/{result['content']['project_slug']}/", "warnings": result["warnings"]})
        except (ContentError, GenerationError) as exc:
            return jsonify({"error": str(exc)}), 400

    @app.get("/content/<project>/<path:filename>")
    def project_media(project: str, filename: str):
        folder = project_dir(project)
        return send_from_directory(folder, filename)

    @app.get("/preview/<slug>/")
    @app.get("/preview/<slug>/<path:filename>")
    def preview(slug: str, filename: str = "index.html"):
        if not PROJECT_RE.fullmatch(slug):
            abort(404)
        return send_from_directory(dist_root / slug, filename)

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"error": "Upload is larger than the 120 MB editor limit. Copy very large media into the project folder manually."}), 413

    return app

