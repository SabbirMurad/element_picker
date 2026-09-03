# Chrome Web Store submission

Copy for the listing, plus the answers the review form asks for. Not part of
the extension package.

## Listing

**Name:** Element Picker

**Category:** Developer Tools

**Short description** (132 characters max — this one is 84):

> Pick any element on a page and grab its HTML and CSS as standalone,
> copy-ready code.

**Detailed description:**

> See a button, card or nav bar you like on any website, and take it with you.
>
> Click the toolbar icon, hover to outline elements, click to pick one. A
> panel opens with three views side by side:
>
> • View — the element rendered on its own, showing exactly what the copied
>   code produces, not how it looked embedded in the page.
> • HTML — the markup, pretty-printed and readable.
> • CSS — self-contained rules that reproduce the element somewhere else.
>
> Edit the HTML or CSS and the preview updates as you type. Copy either one
> with a click.
>
> This is different from the DevTools inspector. DevTools shows you computed
> styles in context; it is not built to get a component out of a page and have
> it still look right. Element Picker resolves the styles that actually matter,
> rewrites relative image URLs so they keep working, and captures ::before and
> ::after — which an inline-style copy cannot express at all.
>
> Nothing is collected, nothing is transmitted, and no host permissions are
> requested. The extension only touches a page after you click its icon.
>
> Known limits, stated up front: :hover states and media queries are not
> captured, and web fonts loaded by the original site will not follow the code
> to your project.

## Single purpose

> Element Picker has one purpose: to let a user select a single element on a
> web page and export its HTML and CSS as standalone, reusable code.

## Permission justifications

**`activeTab`**

> Required to read the DOM and computed styles of the element the user picks.
> activeTab was chosen over host permissions specifically so the extension has
> no standing access to any site — access is granted only when the user clicks
> the extension's toolbar icon, and ends when the tab navigates.

**`scripting`**

> Required to inject the extension's own bundled content scripts into the
> active tab at the moment the user clicks the toolbar icon. The extension uses
> on-demand injection rather than declared content scripts so that nothing runs
> on any page until the user asks for it. No remote code is loaded.

**Host permissions**

> None requested.

**Remote code**

> No. All code is contained in the extension package.

## Data usage disclosures

Every category is answered **not collected**:

| Category | Collected |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

Element content is read into memory to produce the output and discarded when
the panel closes. It is never transmitted or stored.

Certifications to tick:

- Does not sell or transfer user data to third parties outside approved use cases
- Does not use or transfer user data for purposes unrelated to the item's single purpose
- Does not use or transfer user data to determine creditworthiness or for lending

**Privacy policy URL:** point at `PRIVACY.md` in the public repository, or host
the same text on a page you control — the store requires a reachable URL.

## Assets

| Asset | Requirement | Status |
|---|---|---|
| Store icon | 128×128 PNG | `icons/icon128.png` |
| Screenshots | 1280×800 or 640×400, 1–5 of them | **still to capture** |
| Small promo tile | 440×280 | optional |
| Marquee promo tile | 1400×560 | optional |

Screenshot ideas, in order of usefulness: the three-pane panel with a real
component picked; picker mode mid-hover with an element outlined; the preview
updating from an edit.

## Pre-submission checklist

- [ ] Bump `version` in `manifest.json` for each upload
- [ ] Zip the extension directory without `tools/`, `STORE.md` or `.git`
- [ ] Load the zip unpacked once and confirm the picker still works
- [ ] Privacy policy URL reachable
- [ ] Screenshots captured at an exact required size
