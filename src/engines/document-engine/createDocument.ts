import type { Block, DocumentFormat, DocumentModel, RawBlock } from '../../types/document';

const SEP = '\n\n';

let counter = 0;
function newId(): string {
  counter += 1;
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `doc-${counter}-${rnd}`;
}

/** Construye el modelo común a partir de bloques crudos: asigna ids, jerarquía y posiciones en el texto canónico. */
export function createDocument(
  raw: RawBlock[],
  meta: { name: string; format: DocumentFormat; size?: number; pageCount?: number; warnings?: string[] },
): DocumentModel {
  const blocks: Block[] = [];
  const headingStack: { id: string; level: number }[] = [];
  let pos = 0;
  const parts: string[] = [];
  raw
    .filter((r) => r.text.trim().length > 0)
    .forEach((r, i) => {
      const text = r.text.replace(/[ \t]+/g, ' ').trim();
      const id = `b${i}`;
      let parentHeadingId: string | undefined;
      if (r.type === 'heading') {
        const level = r.level ?? 1;
        while (headingStack.length && headingStack[headingStack.length - 1].level >= level) headingStack.pop();
        parentHeadingId = headingStack[headingStack.length - 1]?.id;
        headingStack.push({ id, level });
      } else {
        parentHeadingId = headingStack[headingStack.length - 1]?.id;
      }
      if (parts.length) pos += SEP.length;
      const start = pos;
      pos += text.length;
      parts.push(text);
      blocks.push({ ...r, text, id, parentHeadingId, start, end: pos });
    });
  return {
    id: newId(),
    name: meta.name,
    format: meta.format,
    size: meta.size ?? 0,
    pageCount: meta.pageCount,
    blocks,
    canonicalText: parts.join(SEP),
    warnings: meta.warnings ?? [],
  };
}
