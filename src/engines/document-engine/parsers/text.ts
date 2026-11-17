import type { RawBlock } from '../../../types/document';

/** Texto plano o Markdown → bloques. */
export function textToBlocks(text: string): RawBlock[] {
  const out: RawBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ type: 'paragraph', text: para.join(' ') });
    para = [];
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      out.push({ type: 'heading', level: h[1].length, text: h[2] });
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (ul) {
      flush();
      out.push({ type: 'list-item', ordered: false, text: ul[1] });
      continue;
    }
    const ol = line.match(/^\d{1,2}[.)]\s+(.*)$/);
    if (ol) {
      flush();
      out.push({ type: 'list-item', ordered: true, text: ol[1] });
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      flush();
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      const last = out[out.length - 1];
      if (last?.type === 'table' && last.rows) {
        last.rows.push(cells);
        last.text = last.rows.map((r) => r.join(' | ')).join('\n');
      } else out.push({ type: 'table', rows: [cells], text: cells.join(' | ') });
      continue;
    }
    // Línea corta en MAYÚSCULAS o terminada en ':' aislada → título
    if (para.length === 0 && line.length < 70 && /^[^a-záéíóúñ]*[A-ZÁÉÍÓÚÑ][^a-záéíóúñ]*$/.test(line) && /[A-ZÁÉÍÓÚÑ]{3}/.test(line)) {
      out.push({ type: 'heading', level: 1, text: line });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}
