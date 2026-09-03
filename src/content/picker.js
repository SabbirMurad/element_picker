// Hover highlight + click-to-select, DevTools-style.
//
// The highlight is a separate overlay element positioned over the hovered
// element's bounding box. We never touch the hovered element's own styles,
// so the page cannot reflow or fire CSS transitions because of us.

(() => {
  const ns = (window.__elementPicker = window.__elementPicker || {});
  if (ns.Picker) return;

  const Z_INDEX = '2147483647';

  // Mouse events we swallow while picking, so a click lands on us instead of
  // navigating a link or firing the site's own handlers.
  const SWALLOWED = ['pointerdown', 'mousedown', 'mouseup', 'click', 'auxclick', 'contextmenu'];

  const OVERLAY_CSS = `
    .box {
      position: absolute;
      box-sizing: border-box;
      background: rgba(0, 122, 204, 0.18);
      outline: 1px solid rgba(0, 122, 204, 0.95);
      border-radius: 1px;
    }
    .box[hidden] { display: none; }
    .label {
      position: absolute;
      left: 0;
      max-width: 320px;
      padding: 3px 6px;
      border-radius: 3px;
      background: #007ACC;
      color: #fff;
      font: 500 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label .dim { opacity: 0.75; }
  `;

  function describe(el) {
    let out = el.tagName.toLowerCase();
    if (el.id) out += '#' + el.id;
    const classes = (typeof el.className === 'string' ? el.className : '')
      .trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (classes.length) out += '.' + classes.join('.');
    return out;
  }

  class Picker {
    // isOwnNode lets the controller tell us which nodes belong to the
    // extension's own UI, so the panel is never itself pickable.
    constructor({ onPick, onCancel, isOwnNode } = {}) {
      this.onPick = onPick || (() => {});
      this.onCancel = onCancel || (() => {});
      this.isOwnNode = isOwnNode || (() => false);

      this.active = false;
      this.target = null;
      // Last known pointer position, so we can re-hit-test when the page moves
      // under a stationary cursor.
      this.pointer = null;
      this.host = null;
      this.box = null;
      this.label = null;
      this.cursorStyle = null;

      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseEvent = this._onMouseEvent.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onReflow = this._onReflow.bind(this);
    }

    start() {
      if (this.active) return;
      this.active = true;
      this._buildOverlay();
      this._forceCrosshair();

      document.addEventListener('mousemove', this._onMouseMove, true);
      document.addEventListener('keydown', this._onKeyDown, true);
      window.addEventListener('scroll', this._onReflow, true);
      window.addEventListener('resize', this._onReflow, true);
      for (const type of SWALLOWED) {
        document.addEventListener(type, this._onMouseEvent, true);
      }
    }

    stop() {
      if (!this.active) return;
      this.active = false;
      this.target = null;
      this.pointer = null;

      document.removeEventListener('mousemove', this._onMouseMove, true);
      document.removeEventListener('keydown', this._onKeyDown, true);
      window.removeEventListener('scroll', this._onReflow, true);
      window.removeEventListener('resize', this._onReflow, true);
      for (const type of SWALLOWED) {
        document.removeEventListener(type, this._onMouseEvent, true);
      }

      this.host?.remove();
      this.host = this.box = this.label = null;
      this.cursorStyle?.remove();
      this.cursorStyle = null;
    }

    _buildOverlay() {
      this.host = document.createElement('div');
      this.host.setAttribute('data-element-picker', 'overlay');
      // Spans the viewport but never receives events, so hit-testing the page
      // underneath keeps working.
      for (const [prop, value] of Object.entries({
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        margin: '0', padding: '0', border: '0', pointerEvents: 'none',
        zIndex: Z_INDEX
      })) {
        this.host.style.setProperty(
          prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), value, 'important'
        );
      }

      const root = this.host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = OVERLAY_CSS;
      this.box = document.createElement('div');
      this.box.className = 'box';
      this.box.hidden = true;
      this.label = document.createElement('div');
      this.label.className = 'label';
      this.box.appendChild(this.label);
      root.append(style, this.box);

      (document.body || document.documentElement).appendChild(this.host);
    }

    // Site stylesheets set cursors on their own elements, so a cursor on
    // <html> alone would be overridden on most pages.
    _forceCrosshair() {
      this.cursorStyle = document.createElement('style');
      this.cursorStyle.setAttribute('data-element-picker', 'cursor');
      this.cursorStyle.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
      (document.head || document.documentElement).appendChild(this.cursorStyle);
    }

    _resolve(event) {
      const node = event.composedPath?.()[0] ?? event.target;
      if (!(node instanceof Element)) return null;
      if (this.isOwnNode(node)) return null;
      return node;
    }

    _onMouseMove(event) {
      this.pointer = { x: event.clientX, y: event.clientY };
      const el = this._resolve(event);
      if (!el) {
        this.target = null;
        if (this.box) this.box.hidden = true;
        return;
      }
      if (el === this.target) return;
      this.target = el;
      this._paint();
    }

    // Scrolling and resizing move content under a stationary cursor without
    // firing mousemove, so re-hit-test instead of repainting a stale target.
    _onReflow() {
      if (!this.pointer) return;
      const el = document.elementFromPoint(this.pointer.x, this.pointer.y);
      this.target = el instanceof Element && !this.isOwnNode(el) ? el : null;
      if (this.target) this._paint();
      else if (this.box) this.box.hidden = true;
    }

    _paint() {
      if (!this.box || !this.target) return;
      const rect = this.target.getBoundingClientRect();
      this.box.hidden = false;
      // The host is viewport-fixed at the origin, so client coords map directly.
      this.box.style.left = `${rect.left}px`;
      this.box.style.top = `${rect.top}px`;
      this.box.style.width = `${rect.width}px`;
      this.box.style.height = `${rect.height}px`;

      this.label.innerHTML = '';
      this.label.append(
        describe(this.target),
        Object.assign(document.createElement('span'), {
          className: 'dim',
          textContent: `  ${Math.round(rect.width)} × ${Math.round(rect.height)}`
        })
      );
      // Sit the label above the box unless it would leave the viewport.
      const LABEL_H = 22;
      this.label.style.top = rect.top >= LABEL_H + 2 ? `-${LABEL_H}px` : `${rect.height + 2}px`;
    }

    _onMouseEvent(event) {
      if (this.isOwnNode(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.type !== 'click') return;
      // The event's own target wins: a click can arrive with no preceding
      // mousemove, which would leave this.target on the last hovered element.
      const picked = this._resolve(event) || this.target;
      this.stop();
      if (picked) this.onPick(picked);
      else this.onCancel();
    }

    _onKeyDown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.stop();
      this.onCancel();
    }
  }

  ns.Picker = Picker;
  ns.describe = describe;
})();
