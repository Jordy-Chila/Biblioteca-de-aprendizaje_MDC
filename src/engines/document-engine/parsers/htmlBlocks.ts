import type { RawBlock } from '../../../types/document';

const cellText = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Convierte HTML (salida de mammoth) en bloques: h1-h6, p, li, table. */
export function htmlToBlocks(html: string): RawBlock[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: RawBlock[] = [];

  const walk = (node: Element) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        out.push({ type: 'heading', level: Number(tag[1]), text: cellText(el) });
      } else if (tag === 'p') {
        out.push({ type: 'paragraph', text: cellText(el) });
      } else if (tag === 'ul' || tag === 'ol') {
        for (const li of Array.from(el.children)) {
          if (li.tagName.toLowerCase() !== 'li') continue;
          // texto propio del li (sin sublistas), luego sublistas
          const clone = li.cloneNode(true) as Element;
          clone.querySelectorAll('ul,ol').forEach((n) => n.remove());
          out.push({ type: 'list-item', ordered: tag === 'ol', text: cellText(clone) });
          walk(li);
        }
      } else if (tag === 'table') {
        const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td,th')).map(cellText),
        );
        if (rows.length) out.push({ type: 'table', rows, text: rows.map((r) => r.join(' | ')).join('\n') });
      } else {
        walk(el);
      }
    }
  };
  walk(doc.body);
  return out;
}
