import type { DocumentModel } from '../../../types/document';
import type { Tema } from '../../../types/plan';
import { fromBlock } from '../grounding';
import { slug } from '../../../utils/normalize';

export const INDEX_HEADING = /^(índice|indice|contenido|contenidos|tabla de contenido|table of contents)\b/i;

/** Temas y subtemas a partir de los títulos del documento. */
export function extractTopics(doc: DocumentModel): Tema[] {
  const headings = doc.blocks.filter((b) => b.type === 'heading' && !INDEX_HEADING.test(b.text));
  if (!headings.length) {
    const first = doc.blocks.find((b) => b.type === 'paragraph');
    return [
      {
        id: 'documento',
        titulo: 'Documento completo',
        nivel: 1,
        blockIds: doc.blocks.map((b) => b.id),
        resumen: first ? [fromBlock(firstSentences(first.text), first.id)] : [],
      },
    ];
  }
  const used = new Set<string>();
  const temas: Tema[] = [];
  const idOf = new Map<string, string>();
  // Normalizar niveles: el nivel mínimo presente pasa a ser 1
  const minLevel = Math.min(...headings.map((h) => h.level ?? 1));
  for (const h of headings) {
    let id = slug(h.text);
    while (used.has(id)) id += '-2';
    used.add(id);
    idOf.set(h.id, id);
  }
  const indexBlockIds = new Set(doc.blocks.filter((b) => b.type === 'heading' && INDEX_HEADING.test(b.text)).map((b) => b.id));
  const order = doc.blocks.map((b) => b.id);
  headings.forEach((h) => {
    const level = (h.level ?? 1) - minLevel + 1;
    const startIdx = order.indexOf(h.id);
    const blockIds: string[] = [];
    for (let i = startIdx + 1; i < doc.blocks.length; i++) {
      const b = doc.blocks[i];
      if (b.type === 'heading' && (b.level ?? 1) - minLevel + 1 <= level) break;
      if (b.parentHeadingId && indexBlockIds.has(b.parentHeadingId)) continue;
      blockIds.push(b.id);
    }
    // padre: el título anterior de nivel menor
    let padreId: string | undefined;
    let p = h.parentHeadingId;
    while (p) {
      if (idOf.has(p)) {
        padreId = idOf.get(p);
        break;
      }
      p = doc.blocks.find((b) => b.id === p)?.parentHeadingId;
    }
    const firstPara = blockIds.map((id) => doc.blocks.find((b) => b.id === id)!).find((b) => b.type === 'paragraph' && b.parentHeadingId === h.id);
    temas.push({
      id: idOf.get(h.id)!,
      titulo: h.text,
      nivel: level,
      padreId,
      blockIds,
      resumen: firstPara ? [fromBlock(firstSentences(firstPara.text), firstPara.id)] : [],
    });
  });
  return temas;
}

/** Primeras oraciones (≤ 320 caracteres) de un texto, sin cortar palabras. */
export function firstSentences(text: string, max = 320): string {
  if (text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = '';
  for (const s of sentences) {
    if ((out + s).length > max) break;
    out += s;
  }
  return (out || text.slice(0, max)).trim();
}

/** Tema que contiene un bloque (el más profundo). */
export function topicOfBlock(blockId: string, temas: Tema[]): string {
  let best: Tema | undefined;
  for (const t of temas) if (t.blockIds.includes(blockId) && (!best || t.nivel > best.nivel)) best = t;
  return best?.id ?? temas[0]?.id ?? 'documento';
}

/** Raíz de nivel 1 de un tema. */
export function rootTopic(temaId: string, temas: Tema[]): Tema | undefined {
  let t = temas.find((x) => x.id === temaId);
  while (t?.padreId) t = temas.find((x) => x.id === t!.padreId);
  return t;
}
