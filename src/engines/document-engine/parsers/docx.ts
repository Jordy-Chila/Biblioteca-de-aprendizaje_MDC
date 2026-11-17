import type { RawBlock } from '../../../types/document';
import { htmlToBlocks } from './htmlBlocks';

const STYLE_MAP = [
  "p[style-name='List Bullet'] => ul > li:fresh",
  "p[style-name='List Bullet 2'] => ul > li:fresh",
  "p[style-name='List Number'] => ol > li:fresh",
  "p[style-name='List Number 2'] => ol > li:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Subtitle'] => p:fresh",
];

export async function parseDocx(buf: ArrayBuffer): Promise<RawBlock[]> {
  const mammoth = await import('mammoth');
  const lib = (mammoth as unknown as { default?: typeof mammoth }).default ?? mammoth;
  // En navegador mammoth acepta { arrayBuffer }; en Node (pruebas) necesita { buffer }.
  const input =
    typeof window !== 'undefined' && typeof process === 'undefined'
      ? { arrayBuffer: buf }
      : ({ buffer: Buffer.from(buf) } as unknown as { arrayBuffer: ArrayBuffer });
  const result = await lib.convertToHtml(input, { styleMap: STYLE_MAP });
  return htmlToBlocks(result.value);
}
