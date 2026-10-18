from __future__ import annotations

import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path

from generator.engine import _clean_layout, generate_site
from generator.loader import caption_from_filename, load_project
from generator.organizer import classify, organize
from generator.reasons import DEFAULT_REASONS, build_reasons

SOURCE_ROOT = Path(__file__).resolve().parents[1]


class FeatureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in ("templates", "shared", "WishCraft_GIF_Collection"):
            if (SOURCE_ROOT / name).exists():
                shutil.copytree(SOURCE_ROOT / name, self.root / name)
        # tests only ever see the shipped example project, never anyone's personal content/
        shutil.copytree(SOURCE_ROOT / "content" / "example", self.root / "content" / "default")
        self.inbox = self.root / "inbox"
        self.inbox.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def _drop(self, name: str, data: bytes = b"x") -> tuple[str, Path]:
        path = self.inbox / name
        path.write_bytes(data)
        return name, path

    def test_classify(self):
        self.assertEqual(classify("a.JPG"), "photos")
        self.assertEqual(classify("sticker_cake.png"), "stickers")
        self.assertEqual(classify("party.gif"), "gifs")
        self.assertEqual(classify("reasons.txt"), "texts")
        self.assertIsNone(classify("notes.docx"))
        self.assertIsNone(classify("random.txt"))

    def test_organize_names_numbers_and_dedupes(self):
        project = self.root / "content" / "mine"
        items = [self._drop("Hero.jpg", b"1"), self._drop("My Trip.jpg", b"2"), self._drop("02 Dinner.png", b"3"),
                 self._drop("Voice Mum.mp3", b"4"), self._drop("song.mp3", b"5"), self._drop("zz-copy.jpg", b"2")]
        results = {r.source: r for r in organize(project, items)}
        self.assertEqual(results["Hero.jpg"].target, "photos/00_hero.jpg")
        self.assertEqual(results["02 Dinner.png"].target, "photos/01_dinner.png")  # hero must not consume a number
        self.assertEqual(results["My Trip.jpg"].target, "photos/02_my-trip.jpg")
        self.assertEqual(results["Voice Mum.mp3"].target, "audios/voice_mum.mp3")
        self.assertEqual(results["song.mp3"].target, "audios/01_song.mp3")
        self.assertEqual(results["zz-copy.jpg"].status, "skipped")  # identical bytes
        again = organize(project, [self._drop("another.jpg", b"9")])
        self.assertEqual(again[0].target, "photos/03_another.jpg")  # continues the sequence

    def test_dry_run_changes_nothing(self):
        project = self.root / "content" / "dry"
        organize(project, [self._drop("a.jpg")], dry_run=True)
        self.assertFalse(project.exists())

    def test_loader_uses_convention(self):
        project = self.root / "content" / "conv"
        organize(project, [self._drop("hero.jpg", b"1"), self._drop("01_first-trip.jpg", b"2"), self._drop("song.mp3", b"3"),
                           self._drop("voice_mum.mp3", b"4"), self._drop("reasons.txt", "I like A\nI like B\n".encode())])
        content = load_project(self.root, "conv")
        self.assertEqual(content["media"]["hero"], "photos/00_hero.jpg")
        self.assertEqual(content["gallery"][0]["caption"], "First trip")
        self.assertEqual(content["media"]["background_music"], "audios/01_song.mp3")
        self.assertEqual([v["src"] for v in content["voice_messages"]], ["audios/voice_mum.mp3"])
        self.assertEqual(content["voice_messages"][0]["caption"], "A voice note from Mum")
        self.assertEqual(content["reasons"], ["I like A", "I like B"])

    def test_captions(self):
        self.assertEqual(caption_from_filename("03_our-first-trip.jpg"), "Our first trip")
        self.assertEqual(caption_from_filename("hero.jpg"), "")
        self.assertEqual(caption_from_filename("12.jpg"), "")

    def test_reasons_bank(self):
        self.assertEqual(len(DEFAULT_REASONS), 100)
        merged = build_reasons(["mine"], 100, True)
        self.assertEqual(len(merged), 100)
        self.assertEqual(merged[0], "mine")
        self.assertEqual(build_reasons(["only"], 100, False), ["only"])

    def test_love_templates_get_envelope_and_100_reasons(self):
        for template_id in (4, 6, 7):
            with self.subTest(template_id=template_id):
                html = (generate_site(self.root, "default", template_id, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
                self.assertIn("data-envelope", html)
                self.assertEqual(len(re.findall(r'class="heart-tile"', html)), 100)
                self.assertIn("100 reasons I love you", html)

    def test_birthday_has_no_love_sections_but_has_site_chrome(self):
        html = (generate_site(self.root, "default", 1, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("data-envelope", html)
        for marker in ("data-site-nav", "data-splash", "data-to-top", "data-particles", "og:title", 'rel="icon"'):
            self.assertIn(marker, html)

    def test_switches_turn_features_off(self):
        project = self.root / "content" / "calm"
        project.mkdir()
        (project / "content.json").write_text(json.dumps({"template_id": 7, "intro_splash": False, "site_nav": False, "love_letter_animation": False, "wow_effects": False}), encoding="utf-8")
        html = (generate_site(self.root, "calm", None, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
        for marker in ("data-splash", "data-site-nav", "data-envelope", "crazy.js"):
            self.assertNotIn(marker, html)

    @unittest.skipUnless((SOURCE_ROOT / "WishCraft_GIF_Collection").is_dir(), "GIF collection is not part of the repository")
    def test_collage_includes_videos_and_gif_pack(self):
        project = self.root / "content" / "mix"
        organize(project, [self._drop("hero.jpg", b"1"), self._drop("01_a.jpg", b"2"), self._drop("02_clip.mp4", b"3")])
        html = (generate_site(self.root, "mix", 1, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
        self.assertIn("tile--video", html)
        self.assertIn("tile--photo", html)
        if (self.root / "WishCraft_GIF_Collection").exists():
            self.assertIn("tile--gif", html)

    def test_layout_is_sanitised_and_applied(self):
        self.assertEqual(_clean_layout({"a.jpg": {"c": 99, "r": 0}, "b": "x", "c": {"c": "bad"}, "<b>": {"c": 2, "r": 3}}),
                         {"a.jpg": {"c": 6, "r": 1}, "<b>": {"c": 2, "r": 3}})
        project = self.root / "content" / "lay"
        organize(project, [self._drop("hero.jpg", b"1"), self._drop("01_a.jpg", b"2")])
        (project / "content.json").write_text(json.dumps({"template_id": 1, "collage_layout": {"assets/content/photos/01_a.jpg": {"c": 3, "r": 2}}}), encoding="utf-8")
        html = (generate_site(self.root, "lay", None, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
        self.assertIn('data-key="assets/content/photos/01_a.jpg" style="--c:3;--r:2"', html)

    @unittest.skipUnless((SOURCE_ROOT / "WishCraft_GIF_Collection").is_dir(), "GIF collection is not part of the repository")
    def test_edit_mode_button_gif_rail_and_switch(self):
        html = (generate_site(self.root, "default", 1, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
        for marker in ("data-edit-toggle", "edit.js", "motion.js", "gif-rail--left", "gif-rail--right"):
            self.assertIn(marker, html)
        project = self.root / "content" / "off"
        project.mkdir()
        (project / "content.json").write_text(json.dumps({"template_id": 1, "edit_mode_button": False, "gif_rail": False}), encoding="utf-8")
        html = (generate_site(self.root, "off", None, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("data-edit-toggle", html)
        self.assertNotIn("gif-rail--left", html)

    def test_layout_api_and_studio_save_keeps_it(self):
        try:
            from editor.app import create_app
        except ModuleNotFoundError:
            self.skipTest("Flask is not installed")
        shutil.copytree(SOURCE_ROOT / "editor", self.root / "editor")
        client = create_app(self.root).test_client()
        self.assertEqual(client.post("/api/projects/default/layout", json={"layout": {"x.jpg": {"c": 2, "r": 2}}}).status_code, 200)
        saved = json.loads((self.root / "content" / "default" / "content.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["collage_layout"], {"x.jpg": {"c": 2, "r": 2}})
        self.assertEqual(client.post("/api/projects/default/layout", json={"nope": 1}).status_code, 400)
        stale = {k: v for k, v in saved.items() if k != "collage_layout"}  # studio form that never saw the layout
        self.assertEqual(client.post("/api/projects/default/save", json=stale).status_code, 200)
        again = json.loads((self.root / "content" / "default" / "content.json").read_text(encoding="utf-8"))
        self.assertEqual(again["collage_layout"], {"x.jpg": {"c": 2, "r": 2}})

    def test_export_folder_is_named_by_invitation_type(self):
        default = self.root / "content" / "default" / "content.json"
        data = json.loads(default.read_text(encoding="utf-8"))
        data.pop("project_slug", None)
        default.write_text(json.dumps(data), encoding="utf-8")
        for template_id, folder in ((5, "wedding-invitation"), (1, "pastel-birthday"), (10, "congratulations")):
            with self.subTest(template_id=template_id):
                out = generate_site(self.root, "default", template_id, overwrite=True)["output_dir"]
                self.assertEqual(out.name, folder)
        other = self.root / "content" / "mum"
        shutil.copytree(self.root / "content" / "default", other)
        self.assertEqual(generate_site(self.root, "mum", 5, overwrite=True)["output_dir"].name, "wedding-invitation-mum")
        data["project_slug"] = "my-own-name"
        default.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(generate_site(self.root, "default", 5, overwrite=True)["output_dir"].name, "my-own-name")

    def test_letter_adds_no_headings_of_its_own(self):
        for template_id in (1, 4, 11):
            with self.subTest(template_id=template_id):
                html = (generate_site(self.root, "default", template_id, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
                self.assertNotIn("Words I wanted you to keep", html)
                self.assertNotIn("A letter, sealed with love", html)
                self.assertNotIn("lovemail__greeting", html)

    def test_dark_designed_templates_ignore_appearance_override(self):
        for template_id, dark in ((2, True), (7, True), (10, True), (11, True), (1, False)):
            with self.subTest(template_id=template_id):
                html = (generate_site(self.root, "default", template_id, overwrite=True)["output_dir"] / "index.html").read_text(encoding="utf-8")
                self.assertEqual('class="scheme-dark"' in html, dark)


if __name__ == "__main__":
    unittest.main()
