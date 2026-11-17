import type { RawBlock } from '../../../types/document';

export interface PdfLine {
  text: string;
  fontSize: number;
  bold: boolean;
  page: number;
}

const BULLET = /^[•▪●◦\-–·]\s*/;
const NUMBERED = /^\d{1,2}[.)]\s+/;

function median(nums: number[]): number {
  if (!nums.length) return 10;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Agrupa líneas de un PDF en bloques: títulos por tamaño/peso de fuente, listas y párrafos. */
export function pdfLinesToBlocks(lines: PdfLine[]): RawBlock[] {
  const body = median(lines.filter((l) => l.text.trim().length > 20).map((l) => l.fontSize));
  const out: RawBlock[] = [];
  let para: { text: string; page: number } | null = null;
  const flush = () => {
    if (para && para.text.trim()) out.push({ type: 'paragraph', text: para.text.trim(), page: para.page });
    para = null;
  };
  for (const l of lines) {
    const t = l.text.trim();
    if (!t) {
      flush();
      continue;
    }
    if (l.fontSize >= body * 1.4 && t.length < 120) {
      flush();
      out.push({ type: 'heading', level: 1, text: t, page: l.page });
    } else if ((l.fontSize >= body * 1.15 || (l.bold && t.length < 90 && !/[.:,;]$/.test(t))) && t.length < 120) {
      flush();
      out.push({ type: 'heading', level: 2, text: t, page: l.page });
    } else if (BULLET.test(t)) {
      flush();
      out.push({ type: 'list-item', ordered: false, text: t.replace(BULLET, ''), page: l.page });
    } else if (NUMBERED.test(t)) {
      flush();
      out.push({ type: 'list-item', ordered: true, text: t.replace(NUMBERED, ''), page: l.page });
    } else {
      const last = out[out.length - 1];
      // continuación de un elemento de lista que se partió en varias líneas
      if (!para && last && last.type === 'list-item' && !/[.!?]$/.test(last.text)) {
        last.text += ' ' + t;
      } else if (para) {
        para.text += (para.text.endsWith('-') ? '' : ' ') + t;
      } else {
        para = { text: t, page: l.page };
      }
      if (para && /[.!?:]$/.test(t) && t.length < 60) flush();
    }
  }
  flush();
  return out;
}

type TextItem = { str: string; transform: number[]; fontName: string; hasEOL?: boolean };

/** Extrae líneas con tamaño de fuente usando PDF.js. */
export async function parsePdf(
  buf: ArrayBuffer,
  onProgress?: (p: number, msg: string) => void,
): Promise<{ blocks: RawBlock[]; pageCount: number }> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await task.promise;
  const lines: PdfLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p / pdf.numPages, `Leyendo página ${p} de ${pdf.numPages}`);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const styles = content.styles as Record<string, { fontFamily?: string }>;
    let current: { parts: string[]; y: number; size: number; bold: boolean } | null = null;
    const push = () => {
      if (current) lines.push({ text: current.parts.join('').replace(/\s+/g, ' '), fontSize: current.size, bold: current.bold, page: p });
      current = null;
    };
    for (const raw of content.items as TextItem[]) {
      if (!('str' in raw)) continue;
      const size = Math.round(Math.hypot(raw.transform[2], raw.transform[3]) * 10) / 10;
      const y = raw.transform[5];
      const family = `${raw.fontName} ${styles[raw.fontName]?.fontFamily ?? ''}`;
      const bold = /bold|black|heavy|semibold/i.test(family);
      if (current && Math.abs(current.y - y) > size * 0.5) {
        const gap = current.y - y;
        push();
        if (gap > size * 1.9) lines.push({ text: '', fontSize: size, bold: false, page: p });
      }
      if (!current) current = { parts: [], y, size, bold };
      current.parts.push(raw.str);
      current.size = Math.max(current.size, size);
      current.bold = current.bold && bold;
      if (raw.hasEOL) push();
    }
    push();
    lines.push({ text: '', fontSize: 0, bold: false, page: p });
    page.cleanup();
  }
  const pageCount = pdf.numPages;
  await task.destroy();
  return { blocks: pdfLinesToBlocks(lines), pageCount };
}

/** Renderiza las páginas de un PDF a imágenes (para OCR de PDF escaneados). */
export async function renderPdfPages(buf: ArrayBuffer, maxPages = 20): Promise<Blob[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await task.promise;
  const out: Blob[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    out.push(await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas'))), 'image/png')));
    page.cleanup();
    canvas.width = canvas.height = 0;
  }
  await task.destroy();
  return out;
}
