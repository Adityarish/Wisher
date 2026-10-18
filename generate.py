#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from generator import ContentError, GenerationError, generate_site, load_project
from generator.loader import load_registry
from generator.validation import validate_content

ROOT = Path(__file__).resolve().parent


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Generate personal celebration websites with WishCraft.")
    command.add_argument("template", nargs="?", type=int, help="Template number (1-12); overrides content.json")
    command.add_argument("--project", default="default", help="Folder name inside content/ (default: default)")
    command.add_argument("--list", action="store_true", help="List available templates")
    command.add_argument("--validate", action="store_true", help="Validate project content without generating")
    command.add_argument("--editor", action="store_true", help="Launch the local visual editor")
    command.add_argument("--serve", action="store_true", help="Serve the generated website locally")
    command.add_argument("--overwrite", action="store_true", help="Replace an existing generated export")
    command.add_argument("--port", type=int, default=8000, help="Preview/editor port (default: 8000)")
    return command


def serve_folder(folder: Path, port: int) -> None:
    handler = lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=str(folder), **kwargs)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError as exc:
        raise GenerationError(f"Could not start preview on port {port}: {exc}") from exc
    print(f"Preview: http://127.0.0.1:{port}/")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPreview stopped.")


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.project == "default" and not (ROOT / "content" / "default").is_dir() and (ROOT / "content" / "example").is_dir():
        args.project = "example"  # fresh clone: personal projects are not in the repository
    try:
        registry = load_registry(ROOT)
        if args.list:
            print("WishCraft templates")
            for item in registry:
                print(f"  {item['id']:>2}. {item['name']} — {item['occasion_label']}")
            return 0
        if args.editor:
            from editor.app import create_app

            app = create_app(ROOT)
            print(f"WishCraft editor: http://127.0.0.1:{args.port}/")
            app.run(host="127.0.0.1", port=args.port, debug=False)
            return 0
        if args.validate:
            content = load_project(ROOT, args.project, args.template)
            errors, warnings = validate_content(content, registry)
            for warning in warnings:
                print(f"Warning: {warning}")
            if errors:
                for error in errors:
                    print(f"Error: {error}", file=sys.stderr)
                return 1
            counts = ", ".join(f"{kind}={len(files)}" for kind, files in content["_discovered"].items())
            print(f"Valid project '{args.project}' ({counts})")
            return 0
        result = generate_site(ROOT, args.project, args.template, args.overwrite)
        counts = ", ".join(f"{kind}={len(files)}" for kind, files in result["content"]["_discovered"].items())
        print(f"Generated '{args.project}' with template {result['template']['id']}: {result['template']['name']}")
        print(f"Media: {counts}")
        for warning in result["warnings"]:
            print(f"Warning: {warning}")
        print(f"Output: {result['output_dir']}")
        if args.serve:
            serve_folder(result["output_dir"], args.port)
        return 0
    except (ContentError, GenerationError) as exc:
        print(f"WishCraft error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

