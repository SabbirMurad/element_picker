// Turns a picked element into standalone HTML + CSS.
//
// Approach: clone the subtree, give every node a generated class, and fill
// those classes from getComputedStyle diffed against the browser's own
// defaults for that tag. Real classes rather than inline styles, because
// inline style attributes cannot express ::before/::after at all.

(() => {
  const ns = (window.__elementPicker = window.__elementPicker || {});
  if (ns.extract) return;

  const PREFIX = 'ep';
  const PSEUDOS = ['::before', '::after'];

  // Resolved widths and heights would pin the copy to whatever size its old
  // parent happened to give it, which is the opposite of reusable. Logical
  // properties duplicate the physical ones, and the *-origin pairs resolve to
  // pixel values that mean nothing in a new context.
  const SKIP_EXACT = new Set([
    'width', 'height', 'inline-size', 'block-size',
    'min-inline-size', 'min-block-size', 'max-inline-size', 'max-block-size',
    'perspective-origin', 'transform-origin'
  ]);
  const SKIP_MATCH = new RegExp(
    '^(-webkit-|-moz-|-ms-|animation)' +
    '|(^|-)(block|inline)-(start|end|size)(-|$)' +
    '|^border-(start|end)-(start|end)-radius$'
  );

  // These all default to currentcolor, so when they merely echo `color` they
  // are implied rather than chosen.
  const CURRENT_COLOR =
    /(^|-)(caret|text-decoration|text-emphasis|column-rule|row-rule|outline|border-(top|right|bottom|left))-color$/;

  // Four-sided longhands read badly; collapse them the way a person would.
  const BOX_GROUPS = [
    ['padding', ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']],
    ['margin', ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']],
    ['border-width', ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width']],
    ['border-style', ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style']],
    ['border-color', ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color']],
    ['border-radius', ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius']]
  ];

  const boxValue = ([a, b, c, d]) => {
    if (a === b && b === c && c === d) return a;
    if (a === c && b === d) return a + ' ' + b;
    if (b === d) return [a, b, c].join(' ');
    return [a, b, c, d].join(' ');
  };

  // Rewrites each complete four-sided group as its shorthand, in place.
  function collapse(decls) {
    const map = new Map(decls);
    const replacement = new Map();

    for (const [short, sides] of BOX_GROUPS) {
      if (!sides.every((side) => map.has(side))) continue;
      replacement.set(sides[0], [short, boxValue(sides.map((side) => map.get(side)))]);
      for (const side of sides.slice(1)) replacement.set(side, null);
    }

    const out = [];
    for (const [prop, value] of decls) {
      if (!replacement.has(prop)) {
        out.push([prop, value]);
        continue;
      }
      const shorthand = replacement.get(prop);
      if (shorthand) out.push(shorthand);
    }
    return out;
  }

  // A colour or width on a line that is not drawn says nothing about how the
  // element looks, and there are a dozen of them per element.
  function isNoise(prop, computed) {
    const border = /^border-(top|right|bottom|left)-(color|width)$/.exec(prop);
    if (border) return computed.getPropertyValue('border-' + border[1] + '-style') === 'none';
    if (/^outline-(color|width|offset)$/.test(prop)) {
      return computed.getPropertyValue('outline-style') === 'none';
    }
    if (/^column-rule-(color|width)$/.test(prop)) {
      return computed.getPropertyValue('column-rule-style') === 'none';
    }
    return false;
  }

  // ...except where the box has no content to size it: an empty spacer or a
  // replaced element is its dimensions, so dropping them would collapse it.
  const REPLACED = new Set(['img', 'svg', 'video', 'canvas', 'iframe', 'object', 'embed']);
  const keepsSize = (el) =>
    REPLACED.has(el.tagName.toLowerCase()) ||
    (!el.firstElementChild && !el.textContent.trim());

  // Attributes that point at the old page's behaviour rather than its looks.
  const DROP_ATTR = /^(on|data-v-|ng-)/i;
  const URL_ATTRS = ['src', 'href', 'poster', 'srcset'];

  const absolute = (url) => {
    try {
      return new URL(url, document.baseURI).href;
    } catch {
      return url;
    }
  };

  // url(...) inside a property value is relative to the stylesheet, which we
  // no longer have, so resolve against the document.
  const absoluteCssUrls = (value) =>
    value.replace(/url\((["']?)([^"')]+)\1\)/g, (m, q, url) =>
      url.startsWith('data:') ? m : `url(${q}${absolute(url)}${q})`);

  // A blank same-origin document gives us each tag's untouched defaults, so we
  // can drop the ~340 properties that are merely the browser being a browser.
  function createBaseline() {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:absolute;left:-9999px;top:0;width:800px;height:600px;border:0;visibility:hidden';
    (document.body || document.documentElement).appendChild(frame);

    const doc = frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head></head><body></body></html>');
    doc.close();

    const cache = new Map();

    return {
      get(tag, pseudo) {
        const key = tag + (pseudo || '');
        if (cache.has(key)) return cache.get(key);

        const probe = doc.createElement(tag);
        doc.body.appendChild(probe);
        const computed = doc.defaultView.getComputedStyle(probe, pseudo || null);
        const snapshot = new Map();
        for (const prop of computed) snapshot.set(prop, computed.getPropertyValue(prop));
        probe.remove();

        cache.set(key, snapshot);
        return snapshot;
      },
      destroy: () => frame.remove()
    };
  }

  function declarationsFor(el, baseline, pseudo) {
    const computed = getComputedStyle(el, pseudo || null);
    const defaults = baseline.get(el.tagName.toLowerCase(), pseudo);
    const allowSize = !pseudo && keepsSize(el);
    const ownColor = computed.getPropertyValue('color');
    const out = [];

    for (const prop of computed) {
      const isSize = prop === 'width' || prop === 'height';
      if (SKIP_EXACT.has(prop) && !(allowSize && isSize)) continue;
      if (SKIP_MATCH.test(prop)) continue;
      if (isNoise(prop, computed)) continue;

      const value = computed.getPropertyValue(prop);
      if (!value || value === defaults.get(prop)) continue;
      if (CURRENT_COLOR.test(prop) && value === ownColor) continue;
      // `auto` is the initial min-size for a flex or grid item, so it only
      // records that the element used to sit in one.
      if ((prop === 'min-width' || prop === 'min-height') && value === 'auto') continue;

      out.push([prop, tidyNumbers(value.includes('url(') ? absoluteCssUrls(value) : value)]);
    }
    return collapse(out);
  }

  // A pseudo-element only exists when it has content, and `content` alone is
  // not worth a rule.
  function pseudoDeclarations(el, baseline, pseudo) {
    const content = getComputedStyle(el, pseudo).content;
    if (!content || content === 'none' || content === 'normal') return null;
    const decls = declarationsFor(el, baseline, pseudo);
    return decls.length ? decls : null;
  }

  // Computed values carry sub-pixel precision nobody wants to read or paste.
  const tidyNumbers = (value) =>
    value.replace(/-?\d+\.\d{3,}/g, (n) => String(Math.round(parseFloat(n) * 100) / 100));

  const rule = (selector, decls) =>
    `${selector} {\n${decls.map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}`;

  function extract(element) {
    const baseline = createBaseline();
    try {
      const clone = element.cloneNode(true);
      const originals = [element, ...element.querySelectorAll('*')];
      const clones = [clone, ...clone.querySelectorAll('*')];
      const rules = [];

      originals.forEach((source, i) => {
        const copy = clones[i];
        if (!copy) return;

        const className = `${PREFIX}-${i}`;
        const decls = declarationsFor(source, baseline);
        if (decls.length) rules.push(rule(`.${className}`, decls));

        for (const pseudo of PSEUDOS) {
          const decls = pseudoDeclarations(source, baseline, pseudo);
          if (decls) rules.push(rule(`.${className}${pseudo}`, decls));
        }

        // The generated class carries every style, so the page's own classes
        // and inline styles would only be dead weight — or worse, collide with
        // the user's own stylesheet.
        copy.removeAttribute('style');
        copy.className = className;

        for (const { name } of [...copy.attributes]) {
          if (DROP_ATTR.test(name)) copy.removeAttribute(name);
        }
        for (const attr of URL_ATTRS) {
          const value = copy.getAttribute(attr);
          if (!value) continue;
          copy.setAttribute(
            attr,
            attr === 'srcset'
              ? value.split(',').map((part) => {
                  const [url, ...rest] = part.trim().split(/\s+/);
                  return [absolute(url), ...rest].join(' ');
                }).join(', ')
              : absolute(value)
          );
        }
      });

      return { html: ns.formatHtml(clone), css: rules.join('\n\n') };
    } finally {
      baseline.destroy();
    }
  }

  ns.extract = extract;
})();
