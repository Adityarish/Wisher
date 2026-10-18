# WishCraft

Turn your own photos, videos, voice notes, GIFs and words into a personal celebration website: a birthday surprise, an anniversary story, a wedding invitation, a thank-you page and more.

The result is one plain folder of static files. The person you send it to needs no account, no app and no internet service, and you need no Python on your side once it is built.

- **12 designs** that all read the same content, so you can try another look by changing one number.
- **Modern motion:** sliding reveals, picture wipes, parallax, a moving nav pill, GIF rails, a cursor ring. Everything respects "reduce motion".
- **Photo and video collage** that rearranges itself for phone, tablet and desktop, with a lightbox.
- **Edit mode** in the site header: drag the edges of any collage picture to reshape it.
- **Love edition:** a sealed envelope that opens and types out your letter, plus "100 reasons I love you".
- **A local studio** (browser editor) with a **Help** button and **Smart upload** that names your files for you.
- **A file-naming convention** so you can simply drop files in a folder and have them show up in the right place.

---

## Contents

1. [Quick start](#quick-start)
2. [Folder layout](#folder-layout)
3. [How to name your files](#how-to-name-your-files) (photos, videos, audio, GIFs, stickers, text)
4. [Let the helper name things for you](#let-the-helper-name-things-for-you)
5. [The 12 designs](#the-12-designs)
6. [Colours, light and dark](#colours-light-and-dark)
7. [Edit mode: reshape your pictures](#edit-mode-reshape-your-pictures)
8. [The studio (visual editor)](#the-studio-visual-editor)
9. [content.json reference](#contentjson-reference)
10. [GIF pack](#gif-pack)
11. [Commands](#commands)
12. [Publish your site](#publish-your-site)
13. [Privacy and what is in Git](#privacy-and-what-is-in-git)
14. [Tests](#tests)
15. [Add your own template](#add-your-own-template)
16. [Troubleshooting](#troubleshooting)

---

## Quick start

You need **Python 3.10 or newer**.

```bash
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt

# Windows PowerShell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Build the demo site that ships with the project, then open it:

```bash
python generate.py 1 --project example --overwrite --serve
```

Open <http://127.0.0.1:8000/>. Try other designs by changing the number (`2` to `12`).

Make your own:

```bash
cp -R content/example content/mira_birthday      # Windows: copy the folder in Explorer
# put your photos in content/mira_birthday/photos/, then:
python generate.py 3 --project mira_birthday --overwrite --serve
```

The finished site is written to `dist/<design-name>/` (see [Publish](#publish-your-site)).

---

## Folder layout

Everything for one wish lives in one folder under `content/`. The folder name is the project name.

```text
content/mira_birthday/
├── content.json        names, title, messages, theme (optional: everything has a default)
├── photos/             pictures (JPG, PNG, WebP, AVIF, SVG)
├── videos/             clips (MP4, WebM, OGV)
├── audios/             music and voice notes (MP3, M4A, OGG, WAV)
├── gifs/               your own animated GIFs
├── stickers/           small PNG or GIF stickers
└── texts/              title.txt, message.txt, letter.txt, reasons.txt ...
```

You do not need `content.json` at all. Drop files into the folders using the names below and run `generate.py`.

The other folders you will see:

```text
generate.py             command line entry point
generator/              the engine (loader, validation, organiser, 100 reasons)
templates/              the 12 designs and the shared page layout
shared/                 CSS and JavaScript used by every design
editor/                 the local studio (Flask)
user_data/              drop zone and helper script for naming files
tests/                  automated tests
content/example/        the demo project that ships with the repository
```

---

## How to name your files

**Short version:** put the file in the right folder, start the name with a number to control the order, and write the caption in the file name.

```text
01_our-first-trip.jpg   ->  tile 1, caption "Our first trip"
02_dinner-by-the-sea.jpg->  tile 2, caption "Dinner by the sea"
```

Names are sorted **naturally**, so `2.jpg` comes before `10.jpg`. Anything works, so a random camera name like `IMG_5259.jpeg` is fine; it just gets no caption.

### Photos (`photos/`)

| File name | What happens |
|---|---|
| `hero.jpg`, `cover.png`, `00_hero.jpg` | The big opening picture. Any name that starts with `hero` or `cover` (an optional leading number is ignored). |
| `01_our-first-trip.jpg` | A collage tile with the caption **Our first trip**. |
| `02_mum-and-me.png` | A collage tile with the caption **Mum and me**. |
| `IMG_5259.jpeg` | A collage tile with no caption. |
| *(no hero file at all)* | The first photo (by number) becomes the hero. |

Caption rules: the leading number is removed, dashes and underscores become spaces, and the first letter is capitalised. These names give **no** caption: `photo`, `image`, `img`, `video`, `clip`, `memory`, or anything over 70 characters.

### Videos (`videos/`)

| File name | What happens |
|---|---|
| `01_hello.mp4` | A video tile **inside the collage**, captioned "Hello". It plays muted and looped while visible; tap it for the lightbox with sound. |
| `03_the-speech.webm` | Same. |

Collage order is **photos first, then videos**. Keep each clip short (under about 80 MB) so it loads quickly on a phone.

### Audio (`audios/`)

| File name | What happens |
|---|---|
| `song.mp3`, `01_our-song.mp3` | **Background music.** The first audio file that does not start with `voice`. It only starts after a tap (browsers require that), with a play/pause and volume control. |
| `voice_mum.mp3` | A **voice message** captioned "A voice note from Mum". Anything starting with `voice` (with an optional number first). |
| `voice.mp3` | A voice message captioned "A voice note for you". |

### GIFs (`gifs/`)

| File name | What happens |
|---|---|
| `sparkle.gif`, `01_party.gif` | Your own GIF. It floats around the page and appears as a collage tile. |

On top of yours, the site can add a themed GIF pack. See [GIF pack](#gif-pack).

### Stickers (`stickers/`)

| File name | What happens |
|---|---|
| `sticker_cake.png`, `sticker_heart.gif` | A small sticker used for decoration (for example on the closing card). The `sticker` prefix tells the helper to file it here. |

### Text (`texts/`)

Plain UTF-8 text files, one per field. They work with Hindi, English, mixed languages and emoji.

| File name | What it sets |
|---|---|
| `title.txt` | The big headline. |
| `subtitle.txt` | The line under the headline. |
| `message.txt` | The main message. |
| `letter.txt` | The long letter. In the love designs it is written onto the paper inside the opening envelope. |
| `closing.txt` | The last line on the page. |
| `reasons.txt` | **One reason per line** for "100 reasons I love you". Missing ones are filled from a built-in list of 100, or set `"reasons_fill_defaults": false` to show only yours. |
| `quotes.txt` | One quote per line. Add the author after a pipe: `Stay curious. \| Someone wise`. |

Values written in `content.json` win over these files, and these files win over the built-in defaults.

### A complete example

```text
content/mira_birthday/
├── photos/
│   ├── hero.jpg                      opening picture
│   ├── 01_first-trip.jpg             "First trip"
│   ├── 02_the-beach.jpg              "The beach"
│   └── 10_graduation-day.jpg         "Graduation day" (sorts after 02, not before)
├── videos/
│   └── 03_hello.mp4                  "Hello", inside the collage
├── audios/
│   ├── song.mp3                      background music
│   └── voice_mum.mp3                 "A voice note from Mum"
├── gifs/
│   └── sparkle.gif                   floating GIF
├── stickers/
│   └── sticker_cake.png              sticker
└── texts/
    ├── title.txt                     "Happy birthday, Mira!"
    ├── letter.txt                    the long letter
    └── reasons.txt                   one reason per line
```

### Good habits

- Use **lowercase letters, digits, dashes and underscores** in names. Spaces and capitals work but get cleaned up by the helper.
- Resize huge photos before adding them. 2000 pixels on the long side is plenty. Phone photos of 10 MB or more slow the page.
- Videos: MP4 (H.264) plays everywhere. Warnings appear for very large files.
- Files starting with `.` and folders such as `.gitkeep` are ignored.
- Unsupported files are skipped with a warning, never a crash.
- Paths in `content.json` must stay inside the project folder (no absolute paths, no `../`).

---

## Let the helper name things for you

You do not have to rename anything yourself. Two tools apply the convention above automatically.

### Command line: `user_data/helper.py`

```bash
# 1. drop any files (or whole folders) into user_data/inbox/
# 2. sort and rename them into a project
python user_data/helper.py --project mira_birthday
# 3. build it
python generate.py 3 --project mira_birthday --overwrite --serve
```

| Option | What it does |
|---|---|
| `--project NAME` | Which `content/NAME/` folder to fill (created if missing). |
| `--hero FILE` | Use this photo as the hero. |
| `--dry-run` | Show what would happen, change nothing. |
| `--move` | Move files out of the inbox instead of copying. |
| `--gif-theme NAME` | Choose a GIF pack theme (`birthday`, `love` ...). |
| `--list-gif-themes` | List the available themes. |
| `--convention` | Print the full naming convention. |

It sorts by file type, numbers files in order (continuing after what is already there), turns names into clean slugs, skips exact duplicates and warns about large files.

### In the studio: Help and Smart upload

Run `python generate.py --editor`, then click **Help** (or press `?`). It shows the convention and has **Smart upload**: drop files or a whole folder, see a preview of where each file will go, then confirm.

Both use the same code, so the results are identical.

---

## The 12 designs

Pick one with the number: `python generate.py 4`. The occasion, your content and the design are independent, so an anniversary can use design 3 and a birthday can use design 12.

| # | Name | Look |
|---|---|---|
| 1 | Pastel Birthday | Cheerful pastel party, balloons, a cake moment |
| 2 | Neon Birthday | Electric night stage, big type, celebration burst (dark) |
| 3 | Birthday Scrapbook | Taped photos and handwritten notes on a desk |
| 4 | Anniversary Story | Editorial love story with a chapter timeline (love edition) |
| 5 | Wedding Invitation | Botanical invitation with monogram, schedule, venue and RSVP link |
| 6 | Wedding Wishes | Ivory and gold gallery for sincere wishes (love edition) |
| 7 | Romantic Surprise | Private sealed-letter experience (love edition, dark) |
| 8 | Friendship Memories | Colourful sticker board of shared memories |
| 9 | Thank You | Warm minimalism with appreciation cards |
| 10 | Congratulations | Bold achievement poster with a trophy reveal (dark) |
| 11 | Festival Greetings | Glowing greeting card with ornamental lights (dark) |
| 12 | Custom Surprise | Modular editorial layout for any occasion |

**Love edition** (anniversary, wedding, romantic): an envelope that opens and types out your letter, plus **100 reasons I love you** as tappable hearts.

Every site also gets a "tap to begin" splash, a sticky navigation bar built from the sections you actually have, light/dark toggle, share button, falling hearts or confetti, back-to-top, social preview tags and print styles. Pages are marked `noindex` because they are personal.

---

## Colours, light and dark

Each design ships with its own carefully matched palette. **By default your site uses it as designed.** You only need these settings to change that, in `content.json` under `"theme"`:

| Setting | Values | Effect |
|---|---|---|
| `palette` | `default`, `pastel`, `jewel`, `earthy`, `monochrome` | `default` keeps the design's own colours. Others recolour the accent. |
| `accent_color` | `""` or a hex such as `"#e86f85"` | Leave empty to keep the design's colours. A value repaints the accent of every design. |
| `appearance` | `auto`, `light`, `dark` | `auto` keeps the design as built. Dark designs (2, 7, 10, 11) always stay dark. |
| `font_pairing` | `expressive`, `classic`, `modern` | Font feel. |
| `animation_intensity` | `subtle`, `playful`, `off` | How lively the motion is. |
| `decoration_density` | `low`, `medium`, `high` | How many floating decorations. |

In the studio, the accent only applies when you tick **Use my accent instead of the template's own colours**.

---

## Edit mode: reshape your pictures

Open the generated site and click **Edit mode** in the header. Then:

- **Drag** the right edge, bottom edge or bottom-right corner of any collage picture to make it wider or taller. A badge shows the size, for example `2 × 2`.
- **Keyboard:** select a picture and press **Shift + arrow keys**. **Esc** leaves edit mode.
- Sizes **snap to the collage grid**, so the layout stays tidy and responsive. Sizes that are too wide for a phone are clamped automatically.
- **Save** writes the sizes into `content.json` as `collage_layout` when the page is open from the studio preview. Anywhere else it copies the JSON and downloads it, so you can paste it in.
- Sizes are also remembered in your browser straight away.
- Run `generate.py` again to bake them in for everyone who opens the site.

Edit mode reshapes collage tiles (photos, videos, GIF tiles). It does not move tiles or resize the hero picture. Turn the button off with `"edit_mode_button": false`.

---

## The studio (visual editor)

```bash
python generate.py --editor
```

Opens a local editor at <http://127.0.0.1:8000/> with a guided flow: Occasion, Template, Personal details, Media, Messages, Style, Preview, Generate. It reads and writes the same `content.json` the command line uses. It only listens on your own computer and has no login, so never expose it to a network.

---

## content.json reference

[`content/example/content.json`](content/example/content.json) is a complete example and [`generator/content.schema.json`](generator/content.schema.json) is the formal schema. Every key is optional.

**People and words**

`recipient_names`, `sender_name`, `relationship`, `title`, `subtitle`, `message`, `letter`, `closing_message`, `reveal_message`, `language`, `timezone`

**Events**

`event_datetime` (drives the countdown), `countdown_enabled`, `couple_names`, `events` (a list with `name`, `datetime`, `venue_name`, `address`, `map_url`, `rsvp_url`)

**Media**

`media.hero`, `media.background_music`, `media.social_preview`, `gallery` (list of `src`, `caption`, `alt`), `videos`, `voice_messages`, `gif_roles`, `sticker_roles`

Entries you write in `gallery` come first and keep their captions. Anything else found in `photos/` is appended automatically.

**Story**

`timeline`, `memory_cards`, `appreciation_cards`, `quotes`, `reasons`

**Behaviour switches**

| Key | Default | Meaning |
|---|---|---|
| `wow_effects` | `true` | The animation layer. `false` gives a calm page. |
| `intro_splash` | `true` | The "tap to begin" screen (it also starts the music). |
| `site_nav` | `true` | Sticky navigation bar. |
| `share_enabled` | `true` | Share button. |
| `edit_mode_button` | `true` | The Edit mode button. |
| `gif_rail` | `true` | The two gliding GIF rows. |
| `love_letter_animation` | `true` | Envelope opening animation. |
| `love_particles` | `auto` | `auto`, `hearts`, `confetti`, `stars`, `none`. |
| `reasons_count` | `100` | Number of hearts in "100 reasons". |
| `reasons_fill_defaults` | `true` | Fill missing reasons from the built-in list. |
| `gif_theme` | `auto` | GIF pack theme, or `none`. |
| `gif_pack_size` | `8` | How many pack GIFs to use (up to 12). |
| `collage_layout` | `{}` | Picture sizes saved by Edit mode. Do not edit by hand. |
| `project_slug` | *(empty)* | Only set this to choose the export folder name yourself. |

Text is always escaped, so a title such as `<script>` shows as plain text.

---

## GIF pack

WishCraft can sprinkle themed GIFs over your page (floating, in the collage, and in the gliding rails). They come from an optional folder named `WishCraft_GIF_Collection/` next to `generate.py`:

```text
WishCraft_GIF_Collection/
├── 01_Love_Romance/            *.gif
├── 03_Birthday_Wishes/         *.gif
├── 06_Wedding_Anniversary/     *.gif
└── ...                         any number of themed folders
```

**This folder is not part of the repository.** It is about 50 MB of third-party GIFs whose licences are not verified, so it is listed in `.gitignore`. Without it everything still works; you just get your own GIFs only.

To use a pack:

1. Create `WishCraft_GIF_Collection/` and put one folder per theme inside it, each holding `.gif` files. Use GIFs you have the right to use.
2. The right theme is chosen from the design (birthday designs use the birthday folder, and so on). Force one with `"gif_theme": "love"` or `--gif-theme love`.
3. GIFs over 2 MB are skipped, and at most 12 are used. Turn it off with `"gif_theme": "none"`.

`python user_data/helper.py --list-gif-themes` shows what is installed. Check the licence of any GIF before you publish a site that uses it.

---

## Commands

```bash
python generate.py 1                              # build design 1 from content/default (or content/example)
python generate.py 3 --project mira_birthday      # another project
python generate.py 5 --project wedding --serve    # build and preview at http://127.0.0.1:8000/
python generate.py --list                         # list the 12 designs
python generate.py --validate --project mira_birthday
python generate.py --editor                       # open the studio
python generate.py 2 --overwrite --port 9000      # replace an existing export, custom port
```

The number overrides `template_id` in `content.json` for that run only. Use `--overwrite` to replace an existing export. If `content/default/` does not exist, `--project default` falls back to `content/example/`.

---

## Publish your site

Each build writes `dist/<design-name>/`, named after the invitation type:

| Design | Project `default` | Project `mira` |
|---|---|---|
| Wedding Invitation | `dist/wedding-invitation/` | `dist/wedding-invitation-mira/` |
| Pastel Birthday | `dist/pastel-birthday/` | `dist/pastel-birthday-mira/` |

Set `project_slug` in `content.json` if you would rather choose the folder name.

Upload the **contents of that folder** to any static host: GitHub Pages, Netlify, Cloudflare Pages, Vercel, or any web server. Keep `index.html` beside `assets/`. All links are relative, so it also works from a sub-folder. You can also zip the folder and send it, or open `index.html` straight from your disk.

Do **not** upload the `content/` folder: it holds your original files.

---

## Privacy and what is in Git

Your wishes are personal, so the repository is set up to keep them private. `.gitignore` excludes:

| Ignored | Why |
|---|---|
| `content/*` (except `content/example/` and `content/README.md`) | Your projects: names, photos, videos, voice notes. |
| `dist/` | Generated sites. Rebuild with `generate.py`. |
| `WishCraft_GIF_Collection/` | Large, third-party licences unverified. |
| `user_data/inbox/*` | Files you drop for the helper. |
| `.venv/`, `__pycache__/`, `.DS_Store`, editor folders, logs, `.env` | Local clutter and secrets. |

What **is** committed: the engine, templates, shared CSS and JavaScript, the studio, the tests, the docs and the demo project `content/example/`.

Exported sites contain no analytics, remote fonts, CDN scripts, tracking pixels or third-party GIF API. External map and RSVP links appear only if you provide them.

---

## Tests

```bash
python -m unittest discover -s tests -v
```

The suite generates all 12 designs, checks that every local asset link resolves, checks natural sort order, minimal and Unicode-heavy content, text-file precedence, path confinement, the naming convention and the helper, the envelope and 100 reasons, Edit mode and layout saving, and that export folders are named by invitation type. Tests only use `content/example/`, never your personal projects. Tests that need the GIF pack are skipped when `WishCraft_GIF_Collection/` is absent.

---

## Add your own template

1. Create `templates/13_your_template/template.html` and `templates/13_your_template/assets/theme.css`.
2. Extend `_base.html` and use the macros in `_macros.html`.
3. Add an entry to `templates/registry.json` with a unique `id`, `name`, `occasion_label`, `supported_sections`, `default_colors` and `interactions`. Add `"scheme": "dark"` if the design is dark by nature.
4. Run the tests. No change to the generator is needed.

Keep text readable: pair every background you hard-code with its own text colour, because a visitor may switch the page to dark.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Output already exists` | Add `--overwrite`. |
| Every design looks the same pink | Check `"theme"` in `content.json`: set `"palette": "default"` and `"accent_color": ""`. |
| Text is hard to read in one design | Set `"appearance": "auto"` and report the design number. |
| A photo is missing | Check the extension (`.jpg`, `.png` ...) and read the warnings printed by `generate.py`. |
| A tile is mostly blank | The picture itself is tall or mostly white. Reshape it in Edit mode, or crop it. |
| No GIFs appear | `WishCraft_GIF_Collection/` is optional and not in the repository. See [GIF pack](#gif-pack). |
| Music does not start | Browsers need a tap first. Tap "begin" on the splash screen. |
| Page is slow | Resize photos to about 2000 px and keep videos short. |
| Port already in use | Use `--port 9000`. |
