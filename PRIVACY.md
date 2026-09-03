# Privacy Policy — Element Picker

Last updated: 3 September 2026

## Summary

Element Picker collects nothing, transmits nothing, and stores nothing. It has
no servers, no analytics, and no accounts.

## What the extension does with page content

When you click the toolbar icon and pick an element, the extension reads that
element's markup and its computed styles in order to produce the HTML and CSS
shown in the panel. This happens entirely inside your browser tab.

That content is held in memory for as long as the panel is open and is
discarded when you close it. It is never written to disk, never sent anywhere,
and never shared with the developer or any third party.

The only time anything leaves the extension is when **you** press a Copy
button, which places the code on your own system clipboard.

## Data collected

None. Specifically, the extension does not collect or transmit:

- personally identifiable information
- health, financial or authentication information
- personal communications
- location
- browsing history, or which sites you visit
- user activity, analytics, telemetry or crash reports
- the content of any page

## Permissions and why they exist

- **`activeTab`** — grants access to a tab only after you click the extension's
  toolbar icon on it, and only until that tab navigates. This is what lets the
  extension read the element you pick.
- **`scripting`** — used to inject the extension's own bundled scripts into
  that tab at the moment you click the icon.

The extension requests **no host permissions**, so it has no standing access to
any site. Nothing runs on any page until you explicitly invoke it.

## Remote code

None. All logic ships inside the extension package, as Manifest V3 requires.
The extension loads no remote scripts and makes no network requests of its own.

The preview pane renders the selected element inside a sandboxed frame with
scripts disabled. That frame may load images, fonts or other media the element
references, directly from their original URLs — the same resources the page you
picked from was already loading.

## Changes

Any change to this policy will be published in this file in the extension's
repository, with the date above updated.

## Contact

Questions about this policy can be raised as an issue at
<https://github.com/SabbirMurad/element_picket>.
