import type { DocumentFormat, DocumentModel, RawBlock } from '../../types/document';
import { createDocument } from './createDocument';
import { EmptyDocumentError, UnreadableFileError, UnsupportedFormatError } from './errors';

export { createDocument } from './createDocument';
export * from './errors';

export type ProgressFn = (fraction: number, message: string) => void;

export function detectFormat(name: string): DocumentFormat | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return 'image';
  return null;
}

export const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp';
export const MAX_SIZE = 60 * 1024 * 1024;

function readText(file: File): Promise<string> {
  return typeof file.text === 'function'
    ? file.text()
    : new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(r.error);
        r.readAsText(file);
      });
}
function readBuffer(file: File): Promise<ArrayBuffer> {
  return typeof file.arrayBuffer === 'function'
    ? file.arrayBuffer()
    : new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as ArrayBuffer);
        r.onerror = () => rej(r.error);
        r.readAsArrayBuffer(file);
      });
}

export function assertHasText(doc: DocumentModel): DocumentModel {
  const words = doc.canonicalText.split(/\s+/).filter((w) => w.length > 1).length;
  if (words < 5) throw new EmptyDocumentError();
  return doc;
}

/** Lee un archivo en el navegador y devuelve el modelo de documento normalizado. Nada sale del navegador. */
export async function ingestFile(file: File, onProgress: ProgressFn = () => {}): Promise<DocumentModel> {
  const format = detectFormat(file.name);
  if (!format) throw new UnsupportedFormatError(file.name);
  if (file.size > MAX_SIZE) throw new UnreadableFileError(`supera ${MAX_SIZE / 1024 / 1024} MB`);
  if (file.size === 0) throw new EmptyDocumentError('El archivo está vacío.');

  let blocks: RawBlock[] = [];
  let pageCount: number | undefined;
  const warnings: string[] = [];
  try {
    onProgress(0.05, 'Leyendo archivo');
    if (format === 'txt' || format === 'md') {
      const { textToBlocks } = await import('./parsers/text');
      blocks = textToBlocks(await readText(file));
    } else if (format === 'docx') {
      const { parseDocx } = await import('./parsers/docx');
      onProgress(0.3, 'Extrayendo contenido del DOCX');
      blocks = await parseDocx(await readBuffer(file));
    } else if (format === 'pptx') {
      const { parsePptx } = await import('./parsers/pptx');
      onProgress(0.3, 'Extrayendo diapositivas');
      ({ blocks, pageCount } = await parsePptx(await readBuffer(file)));
    } else if (format === 'pdf') {
      const { parsePdf, renderPdfPages } = await import('./parsers/pdf');
      const buf = await readBuffer(file);
      ({ blocks, pageCount } = await parsePdf(buf.slice(0), (p, m) => onProgress(0.05 + p * 0.6, m)));
      const chars = blocks.reduce((n, b) => n + b.text.length, 0);
      if (chars < 40) {
        onProgress(0.4, 'PDF sin texto: aplicando reconocimiento óptico (OCR)');
        const { ocrImage } = await import('./parsers/image');
        const pages = await renderPdfPages(buf.slice(0));
        blocks = [];
        for (let i = 0; i < pages.length; i++) {
          const r = await ocrImage(pages[i], (p, m) => onProgress(0.4 + ((i + p) / pages.length) * 0.5, `${m} · página ${i + 1}/${pages.length}`));
          blocks.push(...r.blocks.map((b) => ({ ...b, page: i + 1 })));
          if (r.confidence < 60) warnings.push(`OCR con confianza baja en la página ${i + 1} (${Math.round(r.confidence)} %).`);
        }
        warnings.push('Texto obtenido por OCR: puede contener errores de reconocimiento.');
        if ((pageCount ?? 0) > pages.length) warnings.push(`Solo se reconocieron las primeras ${pages.length} páginas.`);
      }
    } else if (format === 'image') {
      const { ocrImage } = await import('./parsers/image');
      const r = await ocrImage(file, (p, m) => onProgress(0.05 + p * 0.85, m));
      blocks = r.blocks.map((b) => ({ ...b, page: 1 }));
      pageCount = 1;
      warnings.push('Texto obtenido por OCR: puede contener errores de reconocimiento.');
      if (r.confidence < 60) warnings.push(`Confianza del OCR baja (${Math.round(r.confidence)} %).`);
    }
  } catch (e) {
    if (e instanceof UnsupportedFormatError || e instanceof EmptyDocumentError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch|network|Failed to load|importScripts/i.test(msg)) throw new UnreadableFileError('no se pudo descargar el motor de OCR; revisa tu conexión');
    throw new UnreadableFileError();
  }
  onProgress(0.95, 'Organizando contenido');
  return assertHasText(createDocument(blocks, { name: file.name, format, size: file.size, pageCount, warnings }));
}
