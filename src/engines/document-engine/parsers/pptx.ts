import type { RawBlock } from '../../../types/document';

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';

function slideNumber(path: string): number {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

/** Convierte el XML de una diapositiva en bloques: el marcador de título pasa a título, el resto a párrafos o listas. */
export function slideXmlToBlocks(xml: string, page: number): RawBlock[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out: RawBlock[] = [];
  const shapes = Array.from(doc.getElementsByTagNameNS(P_NS, 'sp'));
  for (const sp of shapes) {
    const ph = sp.getElementsByTagNameNS(P_NS, 'ph')[0];
    const phType = ph?.getAttribute('type') ?? '';
    const isTitle = phType === 'title' || phType === 'ctrTitle';
    const paras = Array.from(sp.getElementsByTagNameNS(A_NS, 'p'));
    for (const p of paras) {
      const text = Array.from(p.getElementsByTagNameNS(A_NS, 't'))
        .map((t) => t.textContent ?? '')
        .join('')
        .trim();
      if (!text) continue;
      if (isTitle) {
        out.push({ type: 'heading', level: 1, text, page });
        continue;
      }
      const pPr = p.getElementsByTagNameNS(A_NS, 'pPr')[0];
      const lvl = Number(pPr?.getAttribute('lvl') ?? 0);
      const numbered = p.getElementsByTagNameNS(A_NS, 'buAutoNum').length > 0;
      const noBullet = p.getElementsByTagNameNS(A_NS, 'buNone').length > 0;
      const isBodyPlaceholder = phType === 'body' || (ph && !phType);
      if (numbered) out.push({ type: 'list-item', ordered: true, text, page });
      else if (!noBullet && (isBodyPlaceholder || lvl > 0)) out.push({ type: 'list-item', ordered: false, text, page });
      else out.push({ type: 'paragraph', text, page });
    }
  }
  // Tablas
  for (const tbl of Array.from(doc.getElementsByTagNameNS(A_NS, 'tbl'))) {
    const rows = Array.from(tbl.getElementsByTagNameNS(A_NS, 'tr')).map((tr) =>
      Array.from(tr.getElementsByTagNameNS(A_NS, 'tc')).map((tc) =>
        Array.from(tc.getElementsByTagNameNS(A_NS, 't'))
          .map((t) => t.textContent ?? '')
          .join(' ')
          .trim(),
      ),
    );
    if (rows.length) out.push({ type: 'table', rows, text: rows.map((r) => r.join(' | ')).join('\n'), page });
  }
  // Si no hay título, usar "Diapositiva N" para no perder la estructura
  if (!out.some((b) => b.type === 'heading') && out.length) out.unshift({ type: 'heading', level: 1, text: `Diapositiva ${page}`, page });
  return out;
}

export async function parsePptx(buf: ArrayBuffer): Promise<{ blocks: RawBlock[]; pageCount: number }> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (!slides.length) throw new Error('sin diapositivas');
  const blocks: RawBlock[] = [];
  for (const path of slides) {
    const xml = await zip.file(path)!.async('string');
    blocks.push(...slideXmlToBlocks(xml, slideNumber(path)));
    // notas del orador
    const notes = zip.file(`ppt/notesSlides/notesSlide${slideNumber(path)}.xml`);
    if (notes) {
      const nx = await notes.async('string');
      const nd = new DOMParser().parseFromString(nx, 'application/xml');
      const txt = Array.from(nd.getElementsByTagNameNS(A_NS, 't'))
        .map((t) => t.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (txt.length > 15 && !/^\d+$/.test(txt)) blocks.push({ type: 'note', text: txt, page: slideNumber(path) });
    }
  }
  return { blocks, pageCount: slides.length };
}
