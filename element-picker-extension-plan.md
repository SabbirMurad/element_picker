# Element Picker Chrome Extension — Project Plan

## Summary

A Chrome extension (Manifest V3) that lets a user pick any element on a webpage
(similar to DevTools' "inspect element" hover-and-click flow) and view it in a
sidebar with three tabs:

1. **View tab** — a live, isolated rendered preview of the selected element,
   showing exactly what the user will get if they copy the code (not the
   element as it looks embedded in the original page, but standalone).
2. **HTML tab** — the pretty-printed HTML (`outerHTML`) of the selected element.
3. **CSS tab** — the CSS needed to reproduce that element's appearance
   standalone, extracted/inlined so it's self-contained.

The core use case: someone sees a button, card, nav bar, or other UI piece on
any website and wants to grab it — HTML + CSS — to reuse in their own project.
This is different from DevTools' element inspector, which shows computed
styles in-context and isn't meant for "copy this out and it still looks
right elsewhere."

## Monetization model (context, not the immediate build priority)

Same trust-based model as the developer's other extensions: full core
functionality free forever, with an optional low-cost "preset" or "supporter"
tier for people who want to pay. No feature gating that breaks core usability.

Planned free vs. paid split (not needed for v1 build, but good to keep in mind
for architecture decisions — e.g. keep the CSS extraction logic modular so a
"pro" mode can be added later):

- **Free**: single-element picker, View/HTML/CSS tabs, inline-style CSS output.
- **Paid/supporter tier (later)**: cleaner CSS extraction as real classes
  instead of inline styles, exporting as a React/Vue component, and
  "grab full sections" (multi-element / whole component trees) instead of
  one element at a time.

## Core user flow

1. User clicks the extension icon → enters "picker mode."
2. Cursor moves over the page; hovered elements are highlighted with an
   overlay (outline box, not an actual CSS border change, to avoid layout
   shift).
3. User clicks an element → selection locks, picker mode exits.
4. A sidebar (injected panel, not the native DevTools panel) opens showing
   the selected element across the three tabs.
5. Pressing `Esc` at any point during picker mode cancels selection.
6. User can copy HTML and CSS via copy buttons in their respective tabs.

## Technical plan

### 1. Picker / highlight mechanics
- Content script listens for `mousemove` to draw a highlight overlay: an
  absolutely-positioned div drawn over the hovered element's
  `getBoundingClientRect()`, not an actual style change to the element
  itself (avoids layout shift / triggering site CSS transitions).
- `click` listener locks the selection; must call `preventDefault()` and
  `stopPropagation()` so the click doesn't trigger the site's own behavior
  (e.g. link navigation, button actions).
- `keydown` listener for `Escape` to cancel picker mode.
- Picker mode toggled on/off via the extension's toolbar icon.

### 2. Sidebar UI
- Injected as a fixed-position panel (shadow DOM to avoid the host page's
  CSS leaking in/out) rather than using `chrome.sidePanel` API initially,
  unless we decide the native side panel is simpler — worth evaluating both.
- Three tabs: View / HTML / CSS, matching the flow above.

### 3. View tab (isolated preview)
- Render the selected element in a sandboxed `<iframe>` using `srcdoc`,
  injecting just that element's `outerHTML` plus the self-contained CSS
  generated in step 5 below.
- Rationale for iframe isolation: the sidebar has its own styling, and we
  don't want the host site's global CSS (resets, dark mode, cascades)
  bleeding into the preview, or the preview's styles bleeding into the
  sidebar UI.

### 4. HTML tab
- Pretty-print `element.outerHTML` using a lightweight formatter (e.g.
  `js-beautify` or similar bundled dependency) since raw `outerHTML` from
  real-world sites is often minified/unreadable.
- Copy-to-clipboard button.

### 5. CSS tab (core technical challenge)
- Goal: self-contained CSS so that if the user pastes the HTML + CSS into
  their own project, it renders the same without the original site's
  stylesheet.
- **v1 approach (simplest, ship first)**: walk the selected element and all
  descendants, call `getComputedStyle()` on each, filter down to properties
  that differ from browser defaults (avoid dumping ~300 irrelevant
  properties), and inline them as `style="..."` attributes directly in the
  HTML output. Less elegant output, but guarantees accurate rendering and is
  far simpler to implement correctly.
- **v2 approach (later/paid tier)**: proper cascade-aware extraction —
  iterate `document.styleSheets`, match selectors against elements via
  `element.matches(selector)`, preserve cascade order and `!important`,
  and generate real scoped CSS classes instead of inline styles.
  - Known gotcha: `document.styleSheets` throws `SecurityError` on
    cross-origin stylesheets without CORS headers. Workaround: fetch the
    stylesheet URL from the extension's background service worker (which has
    host permission privileges content scripts don't) and parse manually.
- Copy-to-clipboard button.

### 4/5 shared note on the Tree/View tab decision
Confirmed: there is **no DOM tree/children browser tab**. The first tab is
purely a rendered visual preview of what will be copied — not a navigable
element tree.

## Permissions & manifest considerations
- Manifest V3.
- Needs `activeTab` and likely `scripting` for content script injection.
- Needs host permissions (`<all_urls>` or on-demand via `activeTab`) —
  broad host access will need a clear privacy policy for Chrome Web Store
  review.
- No remote code execution; all logic bundled in the extension package
  (Manifest V3 requirement).

## Suggested build order (v1 scope)
1. Manifest + basic toolbar icon toggle for picker mode.
2. Content script: hover highlight overlay + click-to-select + Esc-to-cancel.
3. Sidebar injection (shadow DOM) with static 3-tab UI shell.
4. HTML tab: outerHTML extraction + pretty-print + copy button.
5. CSS tab v1: computed-style diffing + inline-style injection into a cloned
   HTML string.
6. View tab: sandboxed iframe rendering the HTML+inline-CSS from step 5.
7. Polish: styling of the sidebar itself, edge case handling (elements with
   background images, pseudo-elements like `::before`/`::after`, SVG
   elements).
8. Later: v2 CSS extraction (real classes, stylesheet parsing), export
   formats, "grab full section" mode — these can be scoped as a v2 milestone
   or a paid-tier feature, not required for initial launch.

## Open questions to resolve during build
- Native `chrome.sidePanel` API vs. custom injected shadow-DOM panel —
  trade-offs in polish vs. simplicity.
- How to handle pseudo-elements (`::before`, `::after`) which have styles
  but aren't part of `outerHTML` — may need to detect and inline as actual
  elements in the exported HTML, or note them as a known v1 limitation.
- How deep to go on "commonly useful" CSS property filtering for v1 (colors,
  typography, spacing/box model, borders, backgrounds, flex/grid layout) vs.
  showing everything with a toggle.
