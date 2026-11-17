import type { Block, DocumentModel } from '../../types/document';
import { normalize, tokens } from '../../utils/normalize';

/** Índice BM25 sobre los bloques del documento (búsqueda local sin IA). */
export class BlockIndex {
  private docs: { block: Block; toks: string[] }[];
  private df = new Map<string, number>();
  private avg: number;

  constructor(doc: DocumentModel) {
    this.docs = doc.blocks.filter((b) => b.type !== 'heading').map((b) => {
      const head = doc.blocks.find((h) => h.id === b.parentHeadingId)?.text ?? '';
      return { block: b, toks: tokens(`${b.text} ${head}`) };
    });
    for (const d of this.docs) for (const t of new Set(d.toks)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avg = this.docs.reduce((s, d) => s + d.toks.length, 0) / Math.max(1, this.docs.length);
  }

  search(query: string, k = 5, restrict?: Set<string>): { block: Block; score: number }[] {
    const q = tokens(query);
    if (!q.length) return [];
    const N = this.docs.length;
    const res: { block: Block; score: number }[] = [];
    for (const d of this.docs) {
      if (restrict && !restrict.has(d.block.id)) continue;
      let s = 0;
      for (const t of q) {
        // coincidencia por prefijo (plurales, conjugaciones simples)
        const tf = d.toks.filter((x) => x === t || (t.length >= 5 && x.startsWith(t.slice(0, -1)))).length;
        if (!tf) continue;
        const idf = Math.log(1 + (N - (this.df.get(t) ?? 0) + 0.5) / ((this.df.get(t) ?? 0) + 0.5));
        s += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.toks.length / this.avg))));
      }
      if (s > 0) res.push({ block: d.block, score: s });
    }
    return res.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

const cache = new WeakMap<DocumentModel, BlockIndex>();
export function indexFor(doc: DocumentModel): BlockIndex {
  let i = cache.get(doc);
  if (!i) cache.set(doc, (i = new BlockIndex(doc)));
  return i;
}

/** Bloques que mencionan alguno de los nombres (palabra completa). */
export function blocksMentioning(doc: DocumentModel, nombres: string[]): Block[] {
  const keys = nombres.map(normalize).filter((k) => k.length >= 3);
  return doc.blocks.filter((b) => {
    const n = normalize(b.text);
    return keys.some((k) => new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(n));
  });
}
