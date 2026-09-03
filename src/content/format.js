// Pretty-printer for the extracted markup. Real-world outerHTML is usually
// minified into one unreadable line, and shipping a formatter beats pulling in
// js-beautify for what amounts to a recursive walk.

(() => {
  const ns = (window.__elementPicker = window.__elementPicker || {});
  if (ns.formatHtml) return;

  const VOID = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);
  // Whitespace is significant inside these, so they are copied verbatim.
  const VERBATIM = new Set(['pre', 'textarea', 'script', 'style']);
  const INDENT = '  ';
  const SINGLE_LINE_MAX = 88;

  const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  const openTag = (el) => {
    const name = el.tagName.toLowerCase();
    const attrs = [...el.attributes]
      .map((a) => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${escapeAttr(a.value)}"`))
      .join('');
    return `<${name}${attrs}>`;
  };

  // Comments and empty text nodes carry nothing worth copying.
  const meaningful = (node) =>
    node.nodeType === Node.ELEMENT_NODE ||
    (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');

  function serialize(node, depth, lines) {
    const pad = INDENT.repeat(depth);

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim().replace(/\s+/g, ' ');
      if (text) lines.push(pad + escapeText(text));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const name = node.tagName.toLowerCase();
    const open = openTag(node);

    if (VOID.has(name)) {
      lines.push(pad + open);
      return;
    }
    if (VERBATIM.has(name)) {
      lines.push(pad + open + node.textContent + `</${name}>`);
      return;
    }

    const children = [...node.childNodes].filter(meaningful);
    if (!children.length) {
      lines.push(`${pad}${open}</${name}>`);
      return;
    }

    // Keep short, text-only elements on one line — a button whose whole body is
    // its label reads far worse split across three.
    const onlyText = children.every((c) => c.nodeType === Node.TEXT_NODE);
    if (onlyText) {
      const text = escapeText(node.textContent.trim().replace(/\s+/g, ' '));
      const line = `${pad}${open}${text}</${name}>`;
      if (line.length <= SINGLE_LINE_MAX) {
        lines.push(line);
        return;
      }
    }

    lines.push(pad + open);
    for (const child of children) serialize(child, depth + 1, lines);
    lines.push(`${pad}</${name}>`);
  }

  ns.formatHtml = (element) => {
    const lines = [];
    serialize(element, 0, lines);
    return lines.join('\n');
  };
})();
