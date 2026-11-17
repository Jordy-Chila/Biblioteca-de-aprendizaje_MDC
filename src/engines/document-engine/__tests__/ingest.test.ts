import { loadParto } from '../../../test/fixtures';
import { htmlToBlocks } from '../parsers/htmlBlocks';
import { pdfLinesToBlocks } from '../parsers/pdf';
import { textToBlocks } from '../parsers/text';
import { slideXmlToBlocks } from '../parsers/pptx';
import { createDocument } from '../createDocument';
import { assertHasText, ingestFile, UnsupportedFormatError, UnreadableFileError, EmptyDocumentError } from '..';


test('createDocument asigna ids, jerarquía y posiciones', () => {
  const doc = createDocument(
    [
      { type: 'heading', level: 1, text: '1. Parto' },
      { type: 'paragraph', text: 'El parto es un proceso.' },
      { type: 'heading', level: 2, text: 'Tipos' },
      { type: 'list-item', ordered: false, text: 'Cesárea: cirugía.' },
    ],
    { name: 'x.docx', format: 'docx' },
  );
  expect(doc.blocks.map((b) => b.id)).toEqual(['b0', 'b1', 'b2', 'b3']);
  expect(doc.blocks[1].parentHeadingId).toBe('b0');
  expect(doc.blocks[3].parentHeadingId).toBe('b2');
  expect(doc.canonicalText.slice(doc.blocks[1].start, doc.blocks[1].end)).toBe('El parto es un proceso.');
});

test('htmlToBlocks', () => {
  const b = htmlToBlocks('<h1>A</h1><p>x</p><ol><li>uno</li></ol><table><tr><td>T</td><td>D</td></tr></table>');
  expect(b.map((x) => x.type)).toEqual(['heading', 'paragraph', 'list-item', 'table']);
  expect(b[2].ordered).toBe(true);
  expect(b[3].rows).toEqual([['T', 'D']]);
});

test('DOCX del parto: títulos, tablas y lista numerada', async () => {
  const doc = await loadParto();
  const h1 = doc.blocks.filter((b) => b.type === 'heading' && b.level === 1).map((b) => b.text);
  expect(h1).toContain('6. Mecanismo del parto: movimientos cardinales');
  expect(doc.blocks.filter((b) => b.type === 'table')).toHaveLength(9);
  const steps = doc.blocks.filter((b) => b.type === 'list-item' && b.ordered);
  expect(steps[0].text.startsWith('Encajamiento:')).toBe(true);
});

test('PDF: líneas a bloques', () => {
  const L = (text: string, fontSize = 10, bold = false) => ({ text, fontSize, bold, page: 1 });
  const b = pdfLinesToBlocks([L('Título', 18), L('Uno de cuerpo que es bastante largo'), L('y sigue aquí.'), L('• Pelvis: hueso'), L('1. Encajamiento')]);
  expect(b.map((x) => x.type)).toEqual(['heading', 'paragraph', 'list-item', 'list-item']);
  expect(b[1].text).toBe('Uno de cuerpo que es bastante largo y sigue aquí.');
  expect(b[3].ordered).toBe(true);
});

test('texto y markdown', () => {
  const b = textToBlocks('# A\n\npárrafo uno\n\n- item: def\n1. paso');
  expect(b[0]).toMatchObject({ type: 'heading', level: 1, text: 'A' });
  expect(b.map((x) => x.type)).toEqual(['heading', 'paragraph', 'list-item', 'list-item']);
});

test('PPTX: título y viñetas de una diapositiva', () => {
  const xml = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>La célula</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Núcleo: contiene el ADN</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld></p:sld>`;
  const b = slideXmlToBlocks(xml, 3);
  expect(b[0]).toMatchObject({ type: 'heading', text: 'La célula', page: 3 });
  expect(b[1]).toMatchObject({ type: 'list-item', text: 'Núcleo: contiene el ADN' });
});

test('errores legibles', async () => {
  await expect(ingestFile(new File(['x'], 'a.xlsx'))).rejects.toBeInstanceOf(UnsupportedFormatError);
  await expect(ingestFile(new File(['no es zip'], 'a.docx'))).rejects.toBeInstanceOf(UnreadableFileError);
  await expect(ingestFile(new File([''], 'a.txt'))).rejects.toBeInstanceOf(EmptyDocumentError);
  expect(() => assertHasText(createDocument([], { name: 's.pdf', format: 'pdf' }))).toThrow(EmptyDocumentError);
});
