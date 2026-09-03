// The result overlay: a full-screen modal in its own shadow root, so the host
// page's CSS cannot reach in and ours cannot leak out.
//
// It exists only once an element has been selected — picker mode shows nothing
// but the highlight box.
//
// View, HTML and CSS sit side by side as three resizable panes rather than
// tabs, so all three are readable at once. Pane bodies are placeholders at
// this stage; they get their real content in the extraction steps.

(() => {
  const ns = (window.__elementPicker = window.__elementPicker || {});
  if (ns.Panel) return;

  const Z_INDEX = '2147483647';
  const MIN_PANE_PX = 160;
  // Shared with the preview frame: a frame's canvas is painted white by the
  // browser and a child document cannot clear it, so the frame has to paint
  // the pane colour itself to look like part of the pane.
  const PANE_BG = '#1E1E1E';

  const PANEL_CSS = `
    :host {
      all: initial;
      display: block;
      color-scheme: dark;
    }
    * { box-sizing: border-box; }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(2px);
    }

    /* A transparent layout shell — the title bar and the pane block are the
       only things that paint, so they float as separate pieces. */
    .surface {
      position: absolute;
      inset: 24px;
      display: flex;
      flex-direction: column;
      background: transparent;
      color: #CCCCCC;
      font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: none;
      margin-bottom: 12px;
      padding: 10px 14px;
      border: 1px solid #333333;
      border-radius: 10px;
      background: #252526;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }
    .title { font-weight: 600; letter-spacing: 0.01em; }
    .target-desc {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 3px 8px;
      border-radius: 5px;
      background: #3C3C3C;
      color: #9CDCFE;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .spacer { flex: 1; }

    .btn {
      flex: none;
      padding: 6px 12px;
      border: 1px solid #3A3D41;
      border-radius: 6px;
      background: #3A3D41;
      color: #CCCCCC;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
      cursor: pointer;
    }
    .btn:hover { background: #45494E; border-color: #45494E; }

    .icon-btn {
      flex: none;
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: #858585;
      font: 18px/1 sans-serif;
      cursor: pointer;
    }
    .icon-btn:hover { background: #37373D; color: #CCCCCC; }

    .panes {
      /* Shared by the tab strip and the divider offset, so a change to the
         tab height cannot leave the dividers riding up beside the labels. */
      --tab-h: 30px;
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: stretch;
    }

    /* flex-basis stays 0 so widths track flex-grow, which the divider drag
       writes in pixels — that keeps the ratio stable across window resizes. */
    .pane {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* The strip only carries the tab: it has no background of its own, so the
       surface shows through across the rest of the width. */
    .pane-head {
      display: flex;
      align-items: flex-end;
      flex: none;
      height: var(--tab-h);
      background: transparent;
    }
    /* Flush to the pane's left edge, curving across the top, running square
       into the body below so the two read as one shape. */
    .pane-tab {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 100%;
      padding: 0 12px;
      border-radius: 6px 6px 0 0;
      background: ${PANE_BG};
      color: #CCCCCC;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
    }
    .pane-icon {
      flex: none;
      width: 15px;
      height: 15px;
      color: var(--icon, #007ACC);
    }
    .pane-icon svg { display: block; width: 100%; height: 100%; }
    /* Only the outer corners round; the inner edges meet the dividers. The
       last pane rounds at the top too — nothing covers that corner, whereas
       the first pane's top-left sits under its flush tab. */
    .pane:first-child .pane-body { border-bottom-left-radius: 10px; }
    .pane:last-child .pane-body {
      border-top-right-radius: 10px;
      border-bottom-right-radius: 10px;
    }
    .head-spacer { flex: 1; }
    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      align-self: center;
      margin-right: 8px;
      padding: 3px 9px;
      border: 1px solid #3A3D41;
      border-radius: 5px;
      background: #2A2D33;
      color: #CCCCCC;
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.4;
      cursor: pointer;
    }
    .copy-btn:hover { background: #45494E; }
    .copy-btn svg { display: block; width: 13px; height: 13px; }

    .pane-body.is-empty { display: grid; place-items: center; padding: 20px; }
    .code {
      display: flex;
      align-items: stretch;
      min-width: 100%;
      width: max-content;
      font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    /* Sticky so the numbers stay put when the code scrolls sideways. */
    .gutter {
      position: sticky;
      left: 0;
      z-index: 1;
      flex: none;
      padding: 12px 10px 12px 12px;
      background: ${PANE_BG};
      color: #858585;
      text-align: right;
      white-space: pre;
      user-select: none;
    }
    .editor { position: relative; flex: 1 0 auto; }
    .highlight,
    .editor textarea {
      margin: 0;
      padding: 12px 16px 12px 4px;
      font: inherit;
      white-space: pre;
      tab-size: 2;
      border: 0;
    }
    .highlight {
      color: #D4D4D4;
      pointer-events: none;
    }
    .editor textarea {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      outline: none;
      resize: none;
      background: transparent;
      color: transparent;
      caret-color: #D4D4D4;
    }
    .editor textarea::selection { background: #264F78; }

    /* VS Code Dark+ token colours. */
    .t-tag   { color: #569CD6; }
    .t-attr  { color: #9CDCFE; }
    .t-str   { color: #CE9178; }
    .t-punc  { color: #808080; }
    .t-text  { color: #D4D4D4; }
    .t-sel   { color: #D7BA7D; }
    .t-prop  { color: #9CDCFE; }
    .t-num   { color: #B5CEA8; }
    .t-fn    { color: #DCDCAA; }
    .t-ident { color: #CE9178; }
    .t-cpunc { color: #D4D4D4; }
    .preview-frame {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: ${PANE_BG};
    }
    .pane-error {
      margin: 0;
      padding: 12px 14px;
      color: #F48771;
      font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: pre-wrap;
    }

    .pane-body {
      flex: 1;
      min-height: 0;
      overflow: auto;
      background: ${PANE_BG};
      scrollbar-width: thin;
      scrollbar-color: #4A4A4A transparent;
    }
    .pane-body::-webkit-scrollbar { width: 6px; height: 6px; }
    .pane-body::-webkit-scrollbar-track { background: transparent; }
    .pane-body::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background: #4A4A4A;
    }
    .pane-body::-webkit-scrollbar-thumb:hover { background: #5A5A5A; }
    .pane-body::-webkit-scrollbar-corner { background: transparent; }

    /* Starts at the body, not at the tab row, so it never runs alongside a
       tab label. */
    .divider {
      flex: none;
      align-self: flex-end;
      width: 5px;
      height: calc(100% - var(--tab-h));
      background: #333333;
      cursor: col-resize;
      touch-action: none;
    }
    .divider:hover, .divider.dragging { background: #007ACC; }

    .placeholder {
      margin: 0;
      max-width: 320px;
      color: #858585;
      text-align: center;
    }


    /* Three columns stop being readable on a narrow window, so stack them.
       !important is needed to beat the inline flex-grow left by a drag. */
    @media (max-width: 860px) {
      .panes { flex-direction: column; }
      .divider { display: none; }
      .pane { flex-grow: 1 !important; }
      .pane + .pane { border-top: 1px solid #333333; }
    }
  `;

  // Stroke-drawn at a 16px grid so they stay legible at 15px: an eye for the
  // rendered preview, angle brackets for markup, braces for a style rule.
  const svg = (paths) =>
    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const ICONS = {
    view: svg('<path d="M1.2 8S3.7 3.6 8 3.6 14.8 8 14.8 8 12.3 12.4 8 12.4 1.2 8 1.2 8Z"/><circle cx="8" cy="8" r="1.9"/>'),
    html: svg('<path d="M5.6 4.7 2 8l3.6 3.3M10.4 4.7 14 8l-3.6 3.3M9.4 3.2 6.6 12.8"/>'),
    copy: svg('<rect x="5.6" y="5.6" width="7.8" height="7.8" rx="1.6"/><path d="M10.4 5.6V4.2A1.6 1.6 0 0 0 8.8 2.6H4.2A1.6 1.6 0 0 0 2.6 4.2v4.6A1.6 1.6 0 0 0 4.2 10.4h1.4"/>'),
    css: svg('<path d="M6.2 2.6c-1.4 0-2 .7-2 1.9v1.2c0 .9-.5 1.5-1.4 1.7v1.2c.9.2 1.4.8 1.4 1.7v1.2c0 1.2.6 1.9 2 1.9"/><path d="M9.8 2.6c1.4 0 2 .7 2 1.9v1.2c0 .9.5 1.5 1.4 1.7v1.2c-.9.2-1.4.8-1.4 1.7v1.2c0 1.2-.6 1.9-2 1.9"/>')
  };

  const PANES = [
    { id: 'view', label: 'View', color: '#4EC9B0', blurb: 'An isolated preview of the selected element, rendered from the copied code.' },
    { id: 'html', label: 'HTML', color: '#E37933', blurb: 'The pretty-printed markup of the selected element.' },
    { id: 'css', label: 'CSS', color: '#519ABA', blurb: 'Self-contained CSS that reproduces the element outside this page.' }
  ];

  class Panel {
    constructor({ onPickAgain, onClose } = {}) {
      this.onPickAgain = onPickAgain || (() => {});
      this.onClose = onClose || (() => {});
      this.host = null;
      this.root = null;
      this.element = null;
      this.result = null;
      this._onKeyDown = this._onKeyDown.bind(this);
    }

    get mounted() {
      return Boolean(this.host?.isConnected);
    }

    mount(element) {
      if (this.mounted) {
        this.setElement(element);
        return;
      }

      this.host = document.createElement('div');
      this.host.setAttribute('data-element-picker', 'panel');
      // Pinned inline and !important, because `:host` rules lose to page CSS
      // that happens to target this element.
      for (const [prop, value] of Object.entries({
        position: 'fixed', top: '0', right: '0', bottom: '0', left: '0',
        margin: '0', padding: '0', border: '0', 'z-index': Z_INDEX
      })) {
        this.host.style.setProperty(prop, value, 'important');
      }

      this.root = this.host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = PANEL_CSS;
      this.root.append(style, this._render());

      (document.body || document.documentElement).appendChild(this.host);
      this.setElement(element);

      // Escape closes the overlay, mirroring how it cancels picker mode.
      document.addEventListener('keydown', this._onKeyDown, true);
    }

    destroy() {
      clearTimeout(this._previewTimer);
      this.frame = null;
      document.removeEventListener('keydown', this._onKeyDown, true);
      this.host?.remove();
      this.host = this.root = null;
      this.element = null;
    }

    setElement(el) {
      this.element = el || null;
      const desc = this.root?.querySelector('.target-desc');
      if (desc) desc.textContent = this.element ? ns.describe(this.element) : '—';
    }

    // The body of one pane, so the extraction steps have a single place to
    // write into.
    paneBody(id) {
      return this.root?.querySelector(`[data-pane="${id}"] .pane-body`) || null;
    }

    // Fills the panes from an extraction result.
    setResult({ html, css }) {
      this.result = { html, css };
      this._setCode('html', html);
      this._setCode('css', css);
      this._mountPreview();
    }

    setError(message) {
      this.result = null;
      for (const id of ['view', 'html', 'css']) {
        const body = this.paneBody(id);
        if (!body) continue;
        body.classList.remove('is-empty');
        body.replaceChildren(
          Object.assign(document.createElement('p'), {
            className: 'pane-error',
            textContent: message
          })
        );
      }
    }

    _setCode(id, text) {
      const body = this.paneBody(id);
      if (!body) return;
      body.classList.toggle('is-empty', !text);

      if (!text) {
        body.replaceChildren(
          Object.assign(document.createElement('p'), {
            className: 'placeholder',
            textContent: 'Nothing to show for this element.'
          })
        );
        return;
      }

      const NL = String.fromCharCode(10);
      const wrap = document.createElement('div');
      wrap.className = 'code';

      const gutter = document.createElement('div');
      gutter.className = 'gutter';
      gutter.setAttribute('aria-hidden', 'true');

      const editor = document.createElement('div');
      editor.className = 'editor';

      const highlighted = document.createElement('pre');
      highlighted.className = 'highlight';
      highlighted.setAttribute('aria-hidden', 'true');

      const input = document.createElement('textarea');
      input.spellcheck = false;
      input.setAttribute('wrap', 'off');
      input.setAttribute('aria-label', id.toUpperCase() + ' source');
      input.value = text;

      // The highlighted layer also sizes the editor, so it has to be repainted
      // on every keystroke or the textarea stops covering the text.
      const paint = () => {
        const value = input.value;
        // Every token is escaped by the highlighter, so this is safe.
        highlighted.innerHTML = ns.highlight[id](value);
        gutter.textContent = value.split(NL).map((_, i) => i + 1).join(NL);
      };
      paint();

      input.addEventListener('input', () => {
        this.result = { ...this.result, [id]: input.value };
        paint();
        this._schedulePreview();
      });

      // Tab belongs to the code here, not to focus traversal.
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        const { selectionStart: from, selectionEnd: to, value } = input;
        input.value = value.slice(0, from) + '  ' + value.slice(to);
        input.selectionStart = input.selectionEnd = from + 2;
        input.dispatchEvent(new Event('input'));
      });

      editor.append(highlighted, input);
      wrap.append(gutter, editor);
      body.replaceChildren(wrap);
    }

    // The preview frame is built once and then patched in place: reassigning
    // srcdoc on every keystroke would reload it and make the preview flicker.
    _mountPreview() {
      const body = this.paneBody('view');
      if (!body) return;
      body.classList.remove('is-empty');

      const frame = document.createElement('iframe');
      frame.className = 'preview-frame';
      // allow-same-origin lets us write into the document; without
      // allow-scripts nothing inside it can execute, so edited markup that
      // contains a <script> stays inert.
      frame.setAttribute('sandbox', 'allow-same-origin');
      frame.setAttribute('title', 'Isolated preview');
      frame.srcdoc =
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<style>html,body{margin:0;padding:16px;background:' + PANE_BG + ';}</style>' +
        '<style id="ep-style"></style></head><body></body></html>';
      frame.addEventListener('load', () => this._applyPreview());

      this.frame = frame;
      body.replaceChildren(frame);
    }

    _schedulePreview() {
      clearTimeout(this._previewTimer);
      this._previewTimer = setTimeout(() => this._applyPreview(), 120);
    }

    _applyPreview() {
      const doc = this.frame?.contentDocument;
      if (!doc?.body || !this.result) return;
      const style = doc.getElementById('ep-style');
      if (style) style.textContent = this.result.css;
      doc.body.innerHTML = this.result.html;
    }

    async _copy(button) {
      const text = this.result?.[button.dataset.copy];
      if (!text) return;

      const label = button.querySelector('.copy-label');
      const original = label.textContent;
      try {
        await navigator.clipboard.writeText(text);
        label.textContent = 'Copied';
      } catch {
        label.textContent = 'Failed';
      }
      setTimeout(() => {
        label.textContent = original;
      }, 1200);
    }

    _render() {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;inset:0;';
      wrap.innerHTML = `
        <div class="backdrop" data-action="close"></div>
        <div class="surface" role="dialog" aria-modal="true" aria-label="Element Picker">
          <header>
            <span class="title">Element Picker</span>
            <code class="target-desc">&mdash;</code>
            <span class="spacer"></span>
            <button class="btn" data-action="pick">Pick another</button>
            <button class="icon-btn" data-action="close" title="Close" aria-label="Close">&times;</button>
          </header>
          <div class="panes">
            ${PANES.map((p, i) => `
              ${i ? '<div class="divider" data-divider="' + (i - 1) + '"></div>' : ''}
              <section class="pane" data-pane="${p.id}" aria-label="${p.label}">
                <div class="pane-head">
                  <span class="pane-tab"><span class="pane-icon" style="--icon:${p.color}">${ICONS[p.id]}</span>${p.label}</span>
                  <span class="head-spacer"></span>
                  ${p.id === 'view' ? '' : `<button class="copy-btn" data-copy="${p.id}">${ICONS.copy}<span class="copy-label">Copy</span></button>`}
                </div>
                <div class="pane-body is-empty"><p class="placeholder">${p.blurb}</p></div>
              </section>`).join('')}
          </div>
        </div>
      `;

      wrap.addEventListener('click', (event) => {
        const copy = event.target.closest?.('[data-copy]');
        if (copy) return this._copy(copy);

        const action = event.target.closest?.('[data-action]')?.dataset.action;
        if (action === 'pick') this.onPickAgain();
        else if (action === 'close') this.onClose();
      });

      wrap.addEventListener('pointerdown', (event) => {
        const divider = event.target.closest?.('[data-divider]');
        if (divider) this._startResize(event, divider);
      });

      return wrap;
    }

    // Drag redistributes width between the two panes flanking the divider;
    // everything else keeps the width it had.
    _startResize(event, divider) {
      const panes = [...this.root.querySelectorAll('.pane')];
      const index = Number(divider.dataset.divider);
      const left = panes[index];
      const right = panes[index + 1];
      if (!left || !right) return;

      event.preventDefault();
      divider.classList.add('dragging');

      // flex-grow is relative across every item in the row, so all three panes
      // must be on the same scale before two of them are rewritten in pixels —
      // otherwise a pane still sitting at the initial `1` gets starved.
      // Measure every pane before writing any of them: writing one reflows the
      // rest, so an interleaved read would record already-collapsed widths.
      const startWidths = panes.map((pane) => pane.getBoundingClientRect().width);
      panes.forEach((pane, i) => {
        pane.style.flexGrow = String(startWidths[i]);
      });

      const startX = event.clientX;
      const leftStart = startWidths[index];
      const rightStart = startWidths[index + 1];
      const total = leftStart + rightStart;

      // Capture keeps the drag alive over iframes in the host page, but it is
      // only an optimisation: the listeners below are on window, so the drag
      // still works if the browser refuses the capture.
      try {
        divider.setPointerCapture(event.pointerId);
      } catch {
        // No capture available — window listeners carry the drag.
      }

      const onMove = (moveEvent) => {
        if (total < MIN_PANE_PX * 2) return;
        const delta = Math.max(
          MIN_PANE_PX - leftStart,
          Math.min(rightStart - MIN_PANE_PX, moveEvent.clientX - startX)
        );
        left.style.flexGrow = String(leftStart + delta);
        right.style.flexGrow = String(rightStart - delta);
      };

      const onUp = () => {
        divider.classList.remove('dragging');
        try {
          divider.releasePointerCapture(event.pointerId);
        } catch {
          // Nothing was captured.
        }
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onUp, true);
      };

      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    }

    _onKeyDown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.onClose();
    }
  }

  ns.Panel = Panel;
})();
