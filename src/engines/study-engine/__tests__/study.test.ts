import { loadParto } from '../../../test/fixtures';
import { analyzeLocal } from '../../../services/ai/localProvider';
import { createDocument } from '../../document-engine/createDocument';
import { construirCurso } from '../planner';
import { corregirPrueba, generarMiniPrueba } from '../quiz';
import { actualizarTarjeta, INTERVALOS_DIAS, pendientes } from '../srs';
import { CONFIG_DEFECTO, type PreguntaMini, type RespuestaUsuario } from '../types';
import { normalize } from '../../../utils/normalize';

async function curso(cfg = CONFIG_DEFECTO) {
  const doc = await loadParto();
  const plan = analyzeLocal(doc);
  return { doc, plan, curso: construirCurso(doc, plan, cfg) };
}

test('el plan divide el documento en fases y bloques con objetivo y tiempos razonables', async () => {
  const { curso: c, doc } = await curso();
  const bloques = c.fases.flatMap((f) => f.bloques);
  expect(bloques.length).toBeGreaterThan(0);
  for (const b of bloques) {
    expect(b.objetivo.length).toBeGreaterThan(10);
    expect(b.minutos.estudio).toBeGreaterThanOrEqual(5);
    expect(b.minutos.estudio).toBeLessThanOrEqual(25);
    expect(b.conceptos.length).toBeLessThanOrEqual(6);
    for (const s of b.segmentos) expect(doc.blocks.some((x) => x.id === s.blockId)).toBe(true);
  }
  // cada fase cabe en el tiempo de sesión (salvo un único bloque más largo que la sesión)
  for (const f of c.fases) if (f.bloques.length > 1) expect(f.minutos).toBeLessThanOrEqual(CONFIG_DEFECTO.minutosSesion);
  // el último bloque de cada fase no tiene descanso (fin de sesión)
  for (const f of c.fases) expect(f.bloques[f.bloques.length - 1].minutos.descanso).toBe(0);
});

test('menos tiempo disponible reparte el contenido en más fases', async () => {
  const corto = (await curso({ ...CONFIG_DEFECTO, minutosSesion: 30 })).curso;
  const largo = (await curso({ ...CONFIG_DEFECTO, minutosSesion: 120 })).curso;
  expect(corto.fases.length).toBeGreaterThanOrEqual(largo.fases.length);
});

test('un tema pequeño cabe en una sola fase', () => {
  const doc = createDocument(
    [
      { type: 'heading', level: 1, text: 'La célula' },
      { type: 'paragraph', text: 'La célula es la unidad básica de la vida. El núcleo contiene el material genético de la célula.' },
      { type: 'paragraph', text: 'La mitocondria es el orgánulo que produce energía para la célula mediante la respiración celular.' },
    ],
    { name: 'celula.txt', format: 'txt' },
  );
  const c = construirCurso(doc, analyzeLocal(doc), CONFIG_DEFECTO);
  expect(c.fases.length).toBe(1);
  expect(c.fases[0].bloques.length).toBe(1);
});

test('los tiempos manuales se respetan', async () => {
  const { curso: c } = await curso({ ...CONFIG_DEFECTO, modoTiempos: 'manual', estudio: 20, descanso: 7 });
  const bs = c.fases.flatMap((f) => f.bloques);
  expect(bs.every((b) => b.minutos.estudio === 20)).toBe(true);
  expect(bs.filter((b) => b.minutos.descanso).every((b) => b.minutos.descanso === 7)).toBe(true);
});

test('las mini pruebas solo usan texto del bloque estudiado', async () => {
  const { curso: c } = await curso();
  for (const b of c.fases.flatMap((f) => f.bloques)) {
    const texto = normalize(b.segmentos.map((s) => s.texto).join(' '));
    const qs = generarMiniPrueba(b, 1);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(5);
    for (const q of qs) {
      // la fuente de cada pregunta está en el bloque (salvo las preguntas que el documento plantea en ese bloque)
      const frag = normalize(q.fuente).slice(0, 40).replace(/…$/, '');
      if (q.tipo !== 'corta' || !b.preguntasDoc.length) expect(texto.includes(frag) || b.conceptos.some((x) => normalize(x.definicion).startsWith(frag))).toBe(true);
    }
  }
});

function responderBien(q: PreguntaMini): RespuestaUsuario {
  if (q.tipo === 'relacionar') return Object.fromEntries(q.pares!.map((p) => [p.key, p.key]));
  if (q.tipo === 'opcion-multiple' || q.tipo === 'verdadero-falso') return q.correcta;
  return q.respuesta;
}

test('corrección: todo bien → avanzar; todo mal → repaso de los conceptos fallados', async () => {
  const { curso: c } = await curso();
  const b = c.fases[0].bloques[0];
  const qs = generarMiniPrueba(b, 3);
  const bien = corregirPrueba(b, qs, Object.fromEntries(qs.map((q) => [q.id, responderBien(q)])));
  expect(bien.nota).toBeGreaterThanOrEqual(0.8);
  expect(bien.recomendacion).toBe('avanzar');
  const mal = corregirPrueba(b, qs, {});
  expect(mal.nota).toBe(0);
  expect(mal.recomendacion).toBe('repaso');
  expect(mal.resultados.every((r) => r.explicacion.length > 0)).toBe(true);
});

test('repetición espaciada: aciertos alargan el intervalo, un fallo lo reinicia', () => {
  const c = { key: 'k', nombre: 'Útero', definicion: 'El útero es un órgano.' };
  const t0 = new Date(2026, 0, 1, 10).getTime();
  let t = actualizarTarjeta(undefined, c, 'c1', 'b1', true, t0);
  expect(t.caja).toBe(1);
  t = actualizarTarjeta(t, c, 'c1', 'b1', true, t0);
  expect(t.caja).toBe(2);
  expect(Math.round((t.proxima - t0) / 86_400_000)).toBeGreaterThanOrEqual(INTERVALOS_DIAS[1] - 1);
  t = actualizarTarjeta(t, c, 'c1', 'b1', false, t0);
  expect(t.caja).toBe(0);
  expect(pendientes([t], t0 + 2 * 86_400_000)).toHaveLength(1);
  expect(pendientes([t], t0)).toHaveLength(0);
});
