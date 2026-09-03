// Syntax highlighting for the two code panes, in VS Code Dark+ colours.
//
// The input is always our own generated output — the formatter's markup and
// the extractor's rule blocks — so these are line-oriented tokenizers rather
// than full parsers. Every emitted piece of text is escaped, so the result is
// safe to assign as innerHTML.

(() => {
  const ns = (window.__elementPicker = window.__elementPicker || {});
  if (ns.highlight) return;

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const NL = String.fromCharCode(10);

  // Never let a span straddle a newline: the panel splits this output on
  // newlines to lay each logical line out as its own row, which is only safe
  // while every newline sits outside the markup.
  const span = (cls, text) => {
    if (!text) return '';
    return text
      .split(NL)
      .map((part) => (part ? `<span class="t-${cls}">${esc(part)}</span>` : ''))
      .join(NL);
  };

  // --- CSS -----------------------------------------------------------------

  const VALUE = new RegExp(
    '("[^"]*"|\'[^\']*\')' +      // 1 string
    '|(#[0-9a-fA-F]{3,8})' +      // 2 hex colour
    '|(-?(?:\\d+\\.?\\d*|\\.\\d+)[a-z%]*)' + // 3 number, with or without a unit
    '|([a-zA-Z_-][\\w-]*)(?=\\()' +          // 4 function name
    '|([a-zA-Z_-][\\w-]*)' +      // 5 bare identifier
    '|(\\s+)' +                   // 6 whitespace
    '|(.)',                       // 7 punctuation
    'g'
  );

  function cssValue(text) {
    let out = '';
    for (const m of text.matchAll(VALUE)) {
      if (m[1]) out += span('str', m[1]);
      else if (m[2] || m[3]) out += span('num', m[2] || m[3]);
      else if (m[4]) out += span('fn', m[4]);
      else if (m[5]) out += span('ident', m[5]);
      else if (m[6]) out += m[6];
      else out += span('cpunc', m[7]);
    }
    return out;
  }

  function css(code) {
    return code.split('\n').map((line) => {
      const selector = /^(\S.*?)\s*\{$/.exec(line);
      if (selector) return span('sel', selector[1]) + span('cpunc', ' {');
      if (line === '}') return span('cpunc', '}');

      const decl = /^(\s+)([-a-zA-Z]+)(:\s*)(.+)(;)$/.exec(line);
      if (decl) {
        return decl[1] + span('prop', decl[2]) + span('cpunc', decl[3]) +
          cssValue(decl[4]) + span('cpunc', decl[5]);
      }
      return esc(line);
    }).join('\n');
  }

  // --- HTML ----------------------------------------------------------------

  const TAG = /<\/?[a-zA-Z][\w-]*(?:\s+[^\s=/>]+(?:\s*=\s*"[^"]*")?)*\s*\/?>/g;
  const ATTR = /(\s+)|([^\s=/>]+)(\s*=\s*)("[^"]*")|([^\s=/>]+)/g;

  function tag(raw) {
    const parts = /^(<\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?>)$/.exec(raw);
    if (!parts) return esc(raw);

    let out = span('punc', parts[1]) + span('tag', parts[2]);
    for (const m of parts[3].matchAll(ATTR)) {
      if (m[1]) out += m[1];
      else if (m[2]) out += span('attr', m[2]) + span('cpunc', m[3]) + span('str', m[4]);
      else out += span('attr', m[5]);
    }
    return out + span('punc', parts[4]);
  }

  function html(code) {
    let out = '';
    let last = 0;
    for (const m of code.matchAll(TAG)) {
      out += span('text', code.slice(last, m.index));
      out += tag(m[0]);
      last = m.index + m[0].length;
    }
    return out + span('text', code.slice(last));
  }

  ns.highlight = { css, html };
})();
