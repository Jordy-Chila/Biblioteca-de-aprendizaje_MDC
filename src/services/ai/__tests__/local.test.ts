import { loadParto } from '../../../test/fixtures';
import { analyzeLocal, localProvider } from '../localProvider';
import { collectAfirmaciones, verifyAfirmacion } from '../../../engines/document-engine/grounding';
import { createDocument } from '../../../engines/document-engine';
import { textToBlocks } from '../../../engines/document-engine/parsers/text';
import { normalize } from '../../../utils/normalize';
import { buildScene } from '../../../engines/visualization-engine';

test('verificación de citas', () => {
  const doc = createDocument([{ type: 'paragraph', text: 'La dilatación completa es de 10 cm.' }], { name: 'd.txt', format: 'txt' });
  expect(verifyAfirmacion({ texto: 'x', origen: 'documento', cita: 'dilatacio\u0301n completa' }, doc)).toMatchObject({ origen: 'documento', verificada: true, blockId: 'b0' });
  expect(verifyAfirmacion({ texto: 'x', origen: 'documento', cita: 'es de 12 cm' }, doc)).toMatchObject({ origen: 'complementario', verificada: false });
  expect(verifyAfirmacion({ texto: 'x', origen: 'documento' }, doc).origen).toBe('complementario');
});

test('análisis local del documento del parto', async () => {
  const doc = await loadParto();
  const plan = analyzeLocal(doc);
  expect(plan.dominio.materia).toBe('Medicina y anatomía');
  expect(plan.dominio.tema.toLowerCase()).toContain('parto');
  const n1 = plan.temas.filter((t) => t.nivel === 1);
  expect(n1).toHaveLength(17);
  expect(n1[0].titulo).toBe('1. Concepto de parto');
  const dil = plan.temas.find((t) => t.titulo === 'Primer período: dilatación')!;
  expect(dil.padreId).toBe(plan.temas.find((t) => t.titulo === '5. Períodos del trabajo de parto')!.id);
  const alum = plan.conceptos.find((c) => c.nombre === 'Alumbramiento')!;
  expect(alum.definicion.some((d) => d.cita === 'Expulsión de la placenta y las membranas.')).toBe(true);
  expect(plan.conceptos.filter((c) => normalize(c.nombre) === 'borramiento')).toHaveLength(1);
  expect(plan.conceptos.find((c) => c.nombre === 'Oxitocina')?.tipo).toBe('sustancia');
  expect(plan.comparaciones.map((c) => c.columnas[0])).toContain('Braxton Hicks');
  const proc = plan.procesos.find((p) => p.nombre.startsWith('6.'))!;
  expect(proc.pasos.map((s) => s.nombre)).toEqual(['Encajamiento', 'Descenso', 'Flexión', 'Rotación interna', 'Extensión', 'Restitución y rotación externa', 'Expulsión']);
  expect(plan.preguntas).toHaveLength(10);
  expect(plan.preguntas[0]).toMatchObject({ pregunta: '¿Qué capa uterina produce las contracciones?', generada: false });
  expect(plan.preguntas[0].respuesta.cita).toBe('El miometrio.');
  expect(plan.alertas.length).toBeGreaterThanOrEqual(2);
  expect(plan.fuentes).toHaveLength(4);
  expect(plan.eventos).toHaveLength(0);
  expect(collectAfirmaciones(plan).filter((a) => !(a.origen === 'documento' && a.verificada))).toEqual([]);
  // escenas: la anatomía del canal del parto usa la pelvis, el líquido amniótico usa el útero
  const anat = n1.find((t) => t.titulo.startsWith('3.'))!;
  expect(plan.escenas.filter((e) => e.temaId === anat.id).map((e) => e.sceneTypeId)).toContain('anatomia.pelvis');
  const liq = n1.find((t) => t.titulo.startsWith('10.'))!;
  expect(plan.escenas.filter((e) => e.temaId === liq.id).map((e) => e.sceneTypeId)).toContain('anatomia.utero');
  // nunca un cerebro en un documento de obstetricia
  expect(plan.escenas.some((e) => e.sceneTypeId === 'anatomia.cerebro')).toBe(false);
  // todas las escenas se pueden construir
  for (const e of plan.escenas) expect(buildScene(e, plan, doc), e.sceneTypeId).not.toBeNull();
  for (const t of n1) expect(plan.escenas.some((e) => e.temaId === t.id), t.titulo).toBe(true);
});

test('documento sin títulos y de otra materia', () => {
  const doc = createDocument(textToBlocks('La célula eucariota tiene núcleo, mitocondrias, ribosomas y aparato de Golgi. La membrana plasmática rodea el citoplasma.\n\nMitocondria: produce energía en forma de ATP.\nRibosomas: sintetizan proteínas.'), { name: 'c.txt', format: 'txt' });
  const plan = analyzeLocal(doc);
  expect(plan.temas).toEqual([expect.objectContaining({ id: 'documento', titulo: 'Documento completo' })]);
  expect(plan.dominio.materia).toBe('Biología');
  expect(plan.escenas.map((e) => e.sceneTypeId)).toContain('biologia.celula');
});

test('tutor local devuelve fragmentos del documento', async () => {
  const doc = await loadParto();
  const plan = analyzeLocal(doc);
  const r = await localProvider.ask(doc, plan, { tipo: 'documento', titulo: 'Documento' }, '¿Qué hormona estimula la producción de leche?', []);
  expect(r.documento.length).toBeGreaterThan(0);
  expect(r.documento.some((a) => /prolactina/i.test(a.texto))).toBe(true);
});

test('párrafo con varias definiciones encadenadas', async () => {
  const { loadParto } = await import('../../../test/fixtures');
  const plan = analyzeLocal(await loadParto());
  for (const n of ['Miometrio', 'Endometrio', 'Perimetrio']) expect(plan.conceptos.find((c) => c.nombre === n), n).toBeDefined();
  expect(plan.conceptos.find((c) => c.nombre === 'Perimetrio')!.definicion[0].cita).toBe('capa externa.');
});

test('no convierte la bibliografía ni párrafos ajenos en conceptos', async () => {
  const { loadParto } = await import('../../../test/fixtures');
  const plan = analyzeLocal(await loadParto());
  expect(plan.conceptos.some((c) => /Organizaci[oó]n Mundial/.test(c.nombre))).toBe(false);
  expect(plan.conceptos.find((c) => c.nombre === 'Fetales o neonatales')).toBeUndefined();
  expect(plan.conceptos.find((c) => c.nombre === 'Estrecho medio')).toBeDefined();
});

test('3D en el estudio: reto y estructuras de los conceptos', async () => {
  const { loadParto } = await import('../../../test/fixtures');
  const { challengeModels, findStructure } = await import('../../../engines/interaction-engine/structures');
  const doc = await loadParto();
  const plan = analyzeLocal(doc);
  const retos = challengeModels(plan, doc).map((m) => m.model.id);
  expect(retos).toEqual(expect.arrayContaining(['anatomia.utero', 'anatomia.pelvis']));
  const mio = plan.conceptos.find((c) => c.nombre === 'Miometrio')!;
  expect(findStructure(mio, plan, doc)?.part.id).toBe('miometrio');
  const corion = plan.conceptos.find((c) => c.nombre === 'Corion')!;
  expect(findStructure(corion, plan, doc)?.part.id).toBe('corion');
});

test('cada tema muestra su propio enfoque y los subtemas secuenciales adaptan el modelo', async () => {
  const { loadParto } = await import('../../../test/fixtures');
  const plan = analyzeLocal(await loadParto());
  const tema = (n: string) => plan.temas.find((t) => t.nivel === 1 && t.titulo.startsWith(n))!;
  const esc = (n: string) => plan.escenas.filter((e) => e.temaId === tema(n).id);
  // períodos: visión general + un aspecto por período, cada uno con sus estructuras
  const periodos = esc('5.');
  const dil = periodos.find((e) => e.titulo === 'Primer período: dilatación')!;
  expect(dil.params.focus).toContain('cervix');
  expect(periodos.find((e) => e.titulo === 'Tercer período: alumbramiento')!.params.focus).toContain('placenta');
  // fisiología: solo las capas de la pared
  expect(esc('4.')[0].params.focus).toEqual(['perimetrio', 'miometrio', 'endometrio']);
  // clasificación: primero su tabla; temas sin modelo: una sola vista
  expect(esc('2.')[0].sceneTypeId).toBe('generico.comparacion');
  expect(esc('8.')).toHaveLength(1);
  // repaso: sin modelos repetidos
  expect(esc('16.').some((e) => !e.sceneTypeId.startsWith('generico.'))).toBe(false);
});
