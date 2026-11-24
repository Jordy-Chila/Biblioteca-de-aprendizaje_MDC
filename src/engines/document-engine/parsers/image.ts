import type { RawBlock } from '../../../types/document';
import { textToBlocks } from './text';

/**
 * OCR con Tesseract.js. El motor y los datos de idioma (español + inglés) vienen incluidos
 * en la aplicación (public/tesseract, preparados por scripts/prepare-offline.mjs): funciona sin conexión.
 */
export async function ocrImage(
  data: Blob | ArrayBuffer,
  onProgress?: (p: number, msg: string) => void,
): Promise<{ blocks: RawBlock[]; confidence: number }> {
  const { createWorker } = await import('tesseract.js');
  const base = new URL('./tesseract/', document.baseURI).href;
  const worker = await createWorker(['spa', 'eng'], 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      const label =
        m.status === 'recognizing text' ? 'Reconociendo texto' : m.status.includes('load') ? 'Cargando motor de OCR' : 'Preparando OCR';
      onProgress?.(m.progress ?? 0, label);
    },
  });
  try {
    const input = data instanceof Blob ? data : new Blob([data]);
    const { data: res } = await worker.recognize(input);
    return { blocks: textToBlocks(res.text ?? ''), confidence: res.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }
}
