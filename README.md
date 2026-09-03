# Element Picker

A Chrome extension (Manifest V3) that lets you pick any element on a page and
grab it as standalone, copy-ready HTML and CSS.

Unlike DevTools' inspector, which shows computed styles *in context*, this
produces markup and styles that still look right when pasted somewhere else.

## How it works

1. Click the toolbar icon to enter picker mode. Hovering outlines elements;
   clicking one selects it. `Esc` cancels.
2. A full-screen overlay opens with three panes side by side:
   - **View** — the selected element rendered in an isolated frame, showing
     exactly what the copied code produces.
   - **HTML** — the pretty-printed markup.
   - **CSS** — self-contained rules that reproduce the element elsewhere.
3. Edit the HTML or CSS and the preview updates live. Copy either pane.

Drag the dividers to resize the panes. `Esc` or a click outside closes the
overlay.

## Install (unpacked)

1. Open `chrome://extensions` and turn on Developer mode.
2. Choose **Load unpacked** and select this directory.

## How the CSS is produced

Every node in the selection gets a generated class (`.ep-0`, `.ep-1`, …) filled
from `getComputedStyle`, diffed against the browser's own defaults for that tag
— measured by probing a bare element of the same tag in a blank iframe. Rules
rather than inline `style` attributes, because inline styles cannot express
`::before` / `::after` at all.

Relative URLs in `src`, `href`, `srcset`, `poster` and in `url()` values are
resolved against the page, so images and background images survive the move.

### Known limits

- **`:hover` and media queries are not captured.** Computed style describes a
  single state. Capturing other states needs cascade-aware extraction from
  `document.styleSheets`.
- **Used values cannot be told apart from authored ones.** An authored `1fr`
  and a resolved `auto` both compute to pixels, so grid tracks come out as
  pixel values.
- **`display` reflects the old parent.** An element that was a flex or grid
  item has its display blockified, which follows it out of the page.
- **Web fonts do not travel.** `font-family` names fonts the original site
  loaded; you need the same fonts available where you paste.

`width` and `height` are dropped, so a copied component sizes naturally rather
than being pinned to whatever its old parent gave it. They are kept for empty
elements and replaced elements (`img`, `svg`, `video`, …), whose dimensions
exist only in CSS.

## Layout

    manifest.json          MV3 manifest
    src/background.js      toolbar button; injects the content scripts
    src/content/picker.js  hover highlight, click-to-select, Esc
    src/content/panel.js   the overlay, panes, editors, preview
    src/content/extract.js computed-style extraction
    src/content/format.js  HTML pretty-printer
    src/content/highlight.js syntax highlighting
    icons/                 generated; see tools/make_icons.py
    tools/make_icons.py    regenerates the icons (needs Pillow)

Nothing is bundled or built — the files ship as they are.

## Permissions

`activeTab` and `scripting` only. Nothing is injected until you click the
toolbar icon on a given tab, and the extension requests no host permissions.
See [PRIVACY.md](PRIVACY.md).
