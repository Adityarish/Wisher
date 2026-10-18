# user_data

Your drop zone. Put your own photos, videos, GIFs, audio and text here, then let `helper.py` sort and rename them into a WishCraft project.

```bash
# 1. copy files into user_data/inbox/  (or pass paths directly)
# 2. sort them into content/<project>/
python user_data/helper.py --project mira_birthday
# 3. build and preview
python generate.py 3 --project mira_birthday --overwrite --serve
```

## Naming convention (optional but nice)

| File name | Becomes |
|---|---|
| `hero.jpg` / `cover.png` | the big opening image |
| `01_our-first-trip.jpg` | gallery tile, caption "Our first trip" |
| `03_hello.mp4` | autoplaying video tile in the collage (click to open with sound) |
| `song.mp3` | background music |
| `voice_mum.mp3` | a voice message |
| `sparkle.gif` | your own floating animated GIF |
| `sticker_cake.png` | a sticker |
| `title.txt`, `message.txt`, `letter.txt`... | page text |
| `reasons.txt` | one reason per line for "100 reasons I love you" |
| `quotes.txt` | one quote per line, optional `quote \| author` |

The same rules power the **Help > Smart upload** button in the editor (`python generate.py --editor`). Any name works; the helper numbers and cleans it. Run `python user_data/helper.py --convention` for the full list, `--dry-run` to preview, `--hero file.jpg` to choose the hero, `--move` to empty the inbox.

## GIF packs

The `WishCraft_GIF_Collection/` is used automatically: a few GIFs float around the page and appear as collage tiles, picked by occasion. Choose another with `--gif-theme birthday` (or set `"gif_theme"` in `content.json`; `"none"` turns it off). `python user_data/helper.py --list-gif-themes` lists them. Note: the collection's Tenor/GIPHY files have unverified licenses, so check before publishing publicly.

Set `"wow_effects": false` in `content.json` for a calm page without the extra animation.
