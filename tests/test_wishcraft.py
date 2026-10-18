from __future__ import annotations

import json
import importlib.util
import re
import shutil
import tempfile
import unittest
from pathlib import Path

from generator.engine import GenerationError, generate_site
from generator.loader import ContentError, load_project, natural_key


SOURCE_ROOT = Path(__file__).resolve().parents[1]


class WishCraftTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in ("templates", "shared"):
            shutil.copytree(SOURCE_ROOT / name, self.root / name)
        # tests only ever see the shipped example project, never anyone's personal content/
        shutil.copytree(SOURCE_ROOT / "content" / "example", self.root / "content" / "default")

    def tearDown(self):
        self.temp.cleanup()

    def test_natural_sort(self):
        names = ["10.jpg", "2.jpg", "01.jpg", "photo 3.jpg"]
        self.assertEqual(sorted(names, key=natural_key), ["01.jpg", "2.jpg", "10.jpg", "photo 3.jpg"])

    def test_every_template_generates_and_links_resolve(self):
        for template_id in range(1, 13):
            with self.subTest(template_id=template_id):
                result = generate_site(self.root, "default", template_id, overwrite=True)
                html_path = result["output_dir"] / "index.html"
                html = html_path.read_text(encoding="utf-8")
                self.assertIn(f"template-{template_id}", html)
                self.assertNotIn("https://cdn", html)
                refs = re.findall(r'(?:src|href)="(assets/[^"]+)"', html)
                self.assertTrue(refs)
                for ref in refs:
                    self.assertTrue((result["output_dir"] / ref).is_file(), ref)

    def test_minimal_unicode_and_long_content(self):
        folder = self.root / "content" / "minimal"
        folder.mkdir()
        message = "जन्मदिन मुबारक हो — with love 🌸\n" + "A long, readable message. " * 80
        (folder / "content.json").write_text(json.dumps({"project_slug": "minimal", "occasion": "custom", "template_id": 12, "title": "प्रिय दोस्त", "message": message}, ensure_ascii=False), encoding="utf-8")
        result = generate_site(self.root, "minimal")
        html = (result["output_dir"] / "index.html").read_text(encoding="utf-8")
        self.assertIn("जन्मदिन मुबारक हो", html)
        self.assertNotIn("<img src=\"None\"", html)

    def test_text_files_are_fallback_but_json_wins(self):
        folder = self.root / "content" / "fallback"
        (folder / "texts").mkdir(parents=True)
        (folder / "texts" / "title.txt").write_text("Text file title", encoding="utf-8")
        (folder / "texts" / "message.txt").write_text("Text file message", encoding="utf-8")
        (folder / "content.json").write_text('{"project_slug":"fallback","template_id":1,"title":"JSON title"}', encoding="utf-8")
        content = load_project(self.root, "fallback")
        self.assertEqual(content["title"], "JSON title")
        self.assertEqual(content["message"], "Text file message")

    def test_asset_reference_cannot_escape_project(self):
        folder = self.root / "content" / "unsafe"
        folder.mkdir()
        (folder / "content.json").write_text('{"title":"Unsafe","media":{"hero":"../../secret.jpg"}}', encoding="utf-8")
        with self.assertRaises(ContentError):
            load_project(self.root, "unsafe")

    def test_user_html_is_escaped(self):
        folder = self.root / "content" / "escaped"
        folder.mkdir()
        (folder / "content.json").write_text(json.dumps({"project_slug": "escaped", "template_id": 1, "title": "<script>alert('no')</script>", "message": "Safe & sound"}), encoding="utf-8")
        result = generate_site(self.root, "escaped")
        html = (result["output_dir"] / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("<script>alert('no')</script>", html)
        self.assertIn("&lt;script&gt;", html)

    def test_export_requires_explicit_overwrite(self):
        generate_site(self.root, "default", 1)
        with self.assertRaises(GenerationError):
            generate_site(self.root, "default", 1)

    @unittest.skipUnless(importlib.util.find_spec("flask"), "Flask is not installed in this test environment")
    def test_editor_save_is_loadable_by_cli_pipeline(self):
        from editor.app import create_app

        app = create_app(self.root)
        client = app.test_client()
        payload = {"project_slug": "editor-project", "occasion": "thank_you", "template_id": 9, "recipient_names": ["Nila"], "title": "Thank you", "message": "For everything."}
        response = client.post("/api/projects/editor_project/save", json=payload)
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        result = generate_site(self.root, "editor_project")
        self.assertTrue((result["output_dir"] / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()

