"""Sort loose files into a WishCraft project using the naming convention.

Shared by user_data/helper.py (command line) and the editor's Help > Smart upload.
"""
from __future__ import annotations

import hashlib
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

KINDS = {
    "photos": {".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg"},
    "videos": {".mp4", ".webm", ".ogv"},
    "audios": {".mp3", ".m4a", ".ogg", ".wav"},
    "gifs": {".gif"},
    "stickers": {".png", ".gif", ".webp", ".svg"},
}
TEXT_NAMES = {"title", "subtitle", "message", "letter", "closing", "reasons", "quotes"}
LARGE_MB = {"videos": 80, "audios": 20, "photos": 15, "gifs": 8, "stickers": 5}

CONVENTION_ROWS = [
    ("hero.jpg  /  cover.png", "photos", "The big opening picture."),
    ("01_our-first-trip.jpg", "photos", "Collage tile. The words become the caption: “Our first trip”."),
    ("03_hello.mp4", "videos", "Video tile in the collage (autoplays muted, click for sound)."),
    ("song.mp3", "audios", "Background music (first audio file that does not start with voice)."),
    ("voice_mum.mp3", "audios", "A voice message. Anything starting with voice becomes one."),
    ("sparkle.gif", "gifs", "Your own floating animated GIF."),
    ("sticker_cake.png", "stickers", "A sticker. Anything starting with sticker goes here."),
    ("title.txt  subtitle.txt  message.txt  letter.txt  closing.txt", "texts", "Page text, one file each."),
    ("reasons.txt", "texts", "One reason per line for the “100 reasons I love you” section."),
    ("quotes.txt", "texts", "One quote per line (optional “ | author”)."),
]


def slugify(stem: str) -> str:
    stem = re.sub(r"^\d+[\s._-]*", "", stem)
    return re.sub(r"[^A-Za-z0-9]+", "-", stem).strip("-").lower()[:48]


def classify(name: str) -> str | None:
    path = Path(name)
    ext, stem = path.suffix.lower(), path.stem.lower()
    if ext == ".txt":
        return "texts" if stem in TEXT_NAMES else None
    if stem.startswith("sticker") and ext in KINDS["stickers"]:
        return "stickers"
    if ext == ".gif":
        return "gifs"
    for kind in ("photos", "videos", "audios"):
        if ext in KINDS[kind]:
            return kind
    return None


def target_name(kind: str, name: str, number: int) -> str:
    path = Path(name)
    ext = ".jpg" if path.suffix.lower() == ".jpeg" else path.suffix.lower()
    stem = path.stem
    if kind == "texts":
        return f"{stem.lower()}.txt"
    if kind == "photos" and re.match(r"(\d+[\s._-]*)?(hero|cover)", stem, re.I):
        return f"00_hero{ext}"
    if kind == "audios" and re.match(r"(\d+[\s._-]*)?voice", stem, re.I):
        rest = slugify(re.sub(r"^(\d+[\s._-]*)?voice[\s._-]*", "", stem, flags=re.I))
        return f"voice_{rest or 'note'}{ext}"
    if kind == "stickers":
        rest = slugify(re.sub(r"^(\d+[\s._-]*)?sticker[\s._-]*", "", stem, flags=re.I))
        return f"{number:02d}_{rest}{ext}" if rest else f"{number:02d}{ext}"
    slug = slugify(stem)
    return f"{number:02d}_{slug}{ext}" if slug else f"{number:02d}{ext}"


def _next_number(folder: Path) -> int:
    highest = 0
    if folder.is_dir():
        for item in folder.iterdir():
            match = re.match(r"(\d+)", item.name)
            if match:
                highest = max(highest, int(match.group(1)))
    return max(highest + 1, 1)


def _digest(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass
class Placed:
    source: str
    status: str  # added | skipped
    kind: str | None = None
    target: str | None = None  # path relative to the project folder
    note: str = ""


def natural_key(value: str) -> list:
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", value)]


def organize(project_dir: Path, items: list[tuple[str, Path]], *, hero: str | None = None, move: bool = False, dry_run: bool = False) -> list[Placed]:
    """items: (original file name, path to read). Returns what happened to each."""
    items = sorted(items, key=lambda item: natural_key(item[0]))
    counters = {kind: _next_number(project_dir / kind) for kind in KINDS}
    seen = {_digest(p) for kind in KINDS for p in (project_dir / kind).glob("*") if p.is_file()} if project_dir.exists() else set()
    results: list[Placed] = []
    for name, source in items:
        kind = classify(name)
        if kind is None:
            results.append(Placed(name, "skipped", note="unsupported file type"))
            continue
        digest = _digest(source) if kind != "texts" else ""
        if digest and digest in seen:
            results.append(Placed(name, "skipped", kind, note="identical file already in the project"))
            continue
        if hero and name == hero and kind == "photos":
            final = f"00_hero{Path(name).suffix.lower().replace('.jpeg', '.jpg')}"
        else:
            final = target_name(kind, name, counters.get(kind, 1))
            if re.match(r"\d\d_", final) and not final.startswith("00_hero") and kind != "texts":
                counters[kind] += 1
        target = project_dir / kind / final
        size_mb = source.stat().st_size / 1024 / 1024
        note = f"large file ({size_mb:.0f} MB) may load slowly" if size_mb > LARGE_MB.get(kind, 1e9) else ""
        if target.exists() and kind != "texts":
            stem, ext, i = target.stem, target.suffix, 2
            while target.exists():
                target = target.with_name(f"{stem}-{i}{ext}")
                i += 1
        if not dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            (shutil.move if move else shutil.copy2)(str(source), str(target))
            if digest:
                seen.add(digest)
        results.append(Placed(name, "added", kind, target.relative_to(project_dir).as_posix(), note))
    return results
