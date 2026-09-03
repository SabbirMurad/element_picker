// Controller: wires the toolbar toggle to the picker and the result overlay.
//
// The two are mutually exclusive by design — picker mode shows only the
// highlight box, and the overlay appears once something has been selected.

(() => {
  const ns = (window.__elementPicker = window.__elementPicker || {});
  // The service worker may inject these files more than once per tab; only the
  // first run installs a controller and a message listener.
  if (ns.controller) return;

  const panel = new ns.Panel({
    onPickAgain: () => startPicking(),
    onClose: () => close()
  });

  const picker = new ns.Picker({
    onPick: (el) => {
      panel.mount(el);
      try {
        panel.setResult(ns.extract(el));
      } catch (err) {
        // A failed extraction should still leave the overlay usable.
        panel.setError('Could not extract this element: ' + (err?.message || err));
        console.error('[element-picker] extraction failed:', err);
      }
      reportState(false);
    },
    onCancel: () => reportState(false),
    // Our own UI must never be pickable. Shadow content retargets to the host,
    // so a containment check on the two hosts covers the overlay and the
    // highlight. They are never on screen at the same time, but the check
    // costs nothing and keeps the picker independent of that ordering.
    isOwnNode: (node) =>
      node instanceof Node &&
      Boolean(panel.host?.contains(node) || picker.host?.contains(node))
  });

  function reportState(active) {
    chrome.runtime.sendMessage({ type: 'PICKER_STATE', active }).catch(() => {});
  }

  function startPicking() {
    // Nothing but the highlight during picking, so the overlay goes away.
    panel.destroy();
    picker.start();
    reportState(true);
  }

  function cancel() {
    picker.stop();
    reportState(false);
  }

  function close() {
    picker.stop();
    panel.destroy();
    reportState(false);
  }

  // One toolbar click cycles: pick -> cancel picking -> close overlay.
  function toggle() {
    if (picker.active) cancel();
    else if (panel.mounted) close();
    else startPicking();
  }

  ns.controller = { toggle, startPicking, cancel, close };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'TOGGLE_PICKER') return;
    toggle();
    sendResponse({ ok: true });
  });
})();
