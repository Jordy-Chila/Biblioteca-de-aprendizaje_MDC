import { readFileSync } from 'node:fs';
import { parseDocx } from '../engines/document-engine/parsers/docx';
import { createDocument } from '../engines/document-engine/createDocument';

export async function loadParto() {
  const buf = readFileSync('tests/fixtures/parto.docx');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return createDocument(await parseDocx(ab), { name: 'parto.docx', format: 'docx', size: buf.byteLength });
}
