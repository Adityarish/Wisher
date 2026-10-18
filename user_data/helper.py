#!/usr/bin/env python3
"""WishCraft upload helper.

Drop your photos, videos, GIFs and audio into user_data/inbox/ (or pass paths),
then run:

    python user_data/helper.py                      # sort inbox -> content/default/
    python user_data/helper.py --project mira       # into content/mira/
    python user_data/helper.py photo1.jpg clip.mp4  # add specific files
    python user_data/helper.py --hero me.jpg        # choose the hero image
    python user_data/helper.py --gif-theme birthday # pick the GIF pack
    python user_data/helper.py --dry-run            # preview, change nothing
    python user_data/helper.py --convention         # print the naming rules

Only the Python standard library is needed. Originals are copied, never modified
(use --move to move them out of the inbox instead).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INBOX = HERE / "inbox"

# Load organizer.py directly so this helper needs only the standard library.
_spec = importlib.util.spec_from_file_location("wishcraft_organizer", ROOT / "generator" / "organizer.py")
_organizer = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = _organizer  # dataclasses needs the module registered
_spec.loader.exec_module(_organizer)
CONVENTION_ROWS, organize = _organizer.CONVENTION_ROWS, _organizer.organize

CONVENTION = "WishCraft file naming convention\n" + "-" * 32 + "\n" + "\n".join(f"  {pattern:<62} {meaning}" if len(pattern) < 62 else f"  {pattern}\n  {'':<62} {meaning}" for pattern, _kind, meaning in CONVENTION_ROWS) + """

Tips: the number sets the order (2 comes before 10). Spaces and symbols in names are
cleaned for you. Put Hindi/emoji captions in content.json; file names stay ASCII-safe.
"""


def set_json_values(project_dir: Path, updates: dict) -> None:
    path = project_dir / "content.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    data.update(updates)
    project_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def list_gif_themes() -> None:
    library = ROOT / "WishCraft_GIF_Collection"
    if not library.is_dir():
        print("WishCraft_GIF_Collection/ not found.")
        return
    print("GIF themes (use the folder name or any keyword, e.g. 'birthday', 'love'):")
    for folder in sorted(p for p in library.iterdir() if p.is_dir()):
        print(f"  {folder.name}  ({len(list(folder.glob('*.gif')))} gifs)")
    print("  auto  -> picks a theme from the template's occasion\n  none  -> no GIFs")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Sort and rename your files into a WishCraft project.")
    ap.add_argument("files", nargs="*", help="Files or folders to add (default: everything in user_data/inbox)")
    ap.add_argument("--project", default="default", help="Project folder inside content/ (default: default)")
    ap.add_argument("--hero", help="File name or path to use as the hero image")
    ap.add_argument("--gif-theme", help="GIF pack: folder name/keyword from WishCraft_GIF_Collection, auto, or none")
    ap.add_argument("--move", action="store_true", help="Move files instead of copying")
    ap.add_argument("--dry-run", action="store_true", help="Show what would happen without changing anything")
    ap.add_argument("--convention", action="store_true", help="Print the naming convention and exit")
    ap.add_argument("--list-gif-themes", action="store_true", help="List available GIF themes and exit")
    args = ap.parse_args(argv)

    if args.convention:
        print(CONVENTION)
        return 0
    if args.list_gif_themes:
        list_gif_themes()
        return 0

    project_dir = (ROOT / "content" / args.project).resolve()
    if (ROOT / "content").resolve() not in project_dir.parents:
        print("Project name must stay inside content/.", file=sys.stderr)
        return 2

    items: list[tuple[str, Path]] = []
    for entry in [Path(f).expanduser() for f in args.files] or [INBOX]:
        if entry.is_dir():
            items.extend((p.name, p) for p in entry.rglob("*") if p.is_file() and not p.name.startswith("."))
        elif entry.is_file():
            items.append((entry.name, entry))
        else:
            print(f"Not found: {entry}", file=sys.stderr)
    hero = Path(args.hero).name if args.hero else None

    results = organize(project_dir, items, hero=hero, move=args.move, dry_run=args.dry_run)
    verb = "move" if args.move else "copy"
    for r in results:
        if r.status == "added":
            print(f"  {verb}   {r.source}  ->  content/{args.project}/{r.target}" + (f"   ({r.note})" if r.note else ""))
        else:
            print(f"  skip   {r.source}  ({r.note})")
    added = sum(r.status == "added" for r in results)
    if args.gif_theme and not args.dry_run:
        set_json_values(project_dir, {"gif_theme": args.gif_theme})
        print(f"  gif_theme set to '{args.gif_theme}' in content.json")
    print(f"\n{'Would add' if args.dry_run else 'Added'} {added} file(s), skipped {len(results) - added}.")
    if added and not args.dry_run:
        print(f"Next: python generate.py 1 --project {args.project} --overwrite --serve")
    elif not items:
        print("Nothing to do. Drop files into user_data/inbox/ or pass paths. See --convention.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
