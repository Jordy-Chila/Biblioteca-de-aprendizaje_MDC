import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { DocumentModel } from '../../types/document';
import { TIPOS_CONCEPTO, type Afirmacion, type Concepto, type Ficha, type StudyPlan } from '../../types/plan';
import { verifyAfirmacion, verifyPlan } from '../../engines/document-engine/grounding';
import { CATALOG, getEntry } from '../../engines/visualization-engine';
import { subtree } from '../../engines/visualization-engine/models/generic';
import { normalize, slug } from '../../utils/normalize';
import type { AIProvider, GeneratedQuestion, OpenGrade, TutorAnswer } from './types';
import { localProvider } from './localProvider';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MODELOS = [
  { id: 'claude-opus-5-5', nombre: 'Claude Opus 5.5 (recomendado)' },
  { id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5 (más rápido y económico)' },
  { id: 'claude-haiku-5-5', nombre: 'Claude Haiku 5.5 (el más económico)' },
];

/** Límite de texto enviado por petición (~150 000 tokens). */
const MAX_CHARS = 450_000;

const SYSTEM = `Eres el motor de análisis de una plataforma educativa que convierte material de estudio en experiencias visuales.
Reglas de fidelidad (obligatorias):
- La información marcada con origen "documento" DEBE estar respaldada por una cita LITERAL copiada exactamente del documento (mismas palabras, sin parafrasear), de 3 a 40 palabras.
- Nunca inventes citas, páginas, autores ni referencias bibliográficas.
- Todo lo que no esté en el documento se marca con origen "complementario" y cita vacía.
- Si el documento no contiene información suficiente, dilo.
- Responde siempre en español.`;

const Claim = z.object({
  texto: z.string().describe('Afirmación redactada para el estudiante.'),
  origen: z.enum(['documento', 'complementario']),
  cita: z.string().describe('Cita literal del documento que respalda la afirmación; vacía si es complementaria.'),
});
type ClaimT = z.infer<typeof Claim>;

const toAfirmacion = (c: ClaimT): Afirmacion => (c.origen === 'documento' ? { texto: c.texto, origen: 'documento', cita: c.cita } : { texto: c.texto, origen: 'complementario' });

function docForPrompt(doc: DocumentModel, restrict?: Set<string>): { text: string; truncated: boolean } {
  let out = '';
  let truncated = false;
  for (const b of doc.blocks) {
    if (restrict && !restrict.has(b.id)) continue;
    const prefix = b.type === 'heading' ? `${'#'.repeat(b.level ?? 1)} ` : b.type === 'list-item' ? '- ' : '';
    const line = `[${b.id}${b.page ? ` p.${b.page}` : ''}] ${prefix}${b.text}\n`;
    if (out.length + line.length > MAX_CHARS) {
      truncated = true;
      break;
    }
    out += line;
  }
  return { text: out, truncated };
}

export class ClaudeError extends Error {}

function explainError(e: unknown): ClaudeError {
  if (e instanceof Anthropic.AuthenticationError) return new ClaudeError('La clave de API de Anthropic no es válida o fue revocada.');
  if (e instanceof Anthropic.PermissionDeniedError) return new ClaudeError('La clave no tiene permiso para usar este modelo.');
  if (e instanceof Anthropic.RateLimitError) return new ClaudeError('Se alcanzó el límite de uso de la API. Espera un momento e inténtalo de nuevo.');
  if (e instanceof Anthropic.BadRequestError) return new ClaudeError(`La API rechazó la petición: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new ClaudeError('No se pudo conectar con la API de Anthropic. Revisa tu conexión a internet.');
  if (e instanceof Anthropic.APIError) return new ClaudeError(`Error de la API de Anthropic (${e.status ?? '?'}): ${e.message}`);
  return new ClaudeError(e instanceof Error ? e.message : String(e));
}

/**
 * Proveedor de IA con salida estructurada. Toda la lógica (análisis, fichas, tutor, preguntas…) es común;
 * cada subclase solo implementa `call`, que envía el mensaje y devuelve JSON validado con zod.
 */
export abstract class LLMProvider implements AIProvider {
  abstract id: 'claude' | 'openai';
  abstract nombre: string;
  externo = true;
  protected testTokens = 200;
  protected abstract call<T extends z.ZodType>(schema: T, user: string, maxTokens?: number): Promise<z.infer<T>>;

  /** Comprueba que la clave funciona con una petición mínima. */
  async test(): Promise<void> {
    await this.call(z.object({ ok: z.boolean() }), 'Responde {"ok": true}.', this.testTokens);
  }

  async analyze(doc: DocumentModel, onProgress?: (f: number, m: string) => void): Promise<StudyPlan> {
    const plan = await localProvider.analyze(doc, onProgress);
    return this.enrich(doc, plan, onProgress);
  }

  async enrich(doc: DocumentModel, plan: StudyPlan, onProgress?: (f: number, m: string) => void): Promise<StudyPlan> {
    onProgress?.(0.6, 'Claude está analizando la estructura del documento');
    const { text } = docForPrompt(doc);
    const temas = plan.temas.map((t) => `${t.id} | nivel ${t.nivel} | ${t.titulo}`).join('\n');
    const catalogo = CATALOG.map((e) => `${e.id} | ${e.titulo} | ${e.tipo}`).join('\n');
    const schema = z.object({
      materia: z.string().describe('Disciplina académica (p. ej. "Medicina › Obstetricia").'),
      tema: z.string().describe('Tema principal del documento.'),
      resumenes: z.array(z.object({ temaId: z.string(), puntos: z.array(Claim) })).describe('2-4 puntos clave por tema de nivel 1.'),
      conceptos: z
        .array(
          z.object({
            nombre: z.string(),
            tipo: z.enum(TIPOS_CONCEPTO),
            temaId: z.string(),
            definicion: Claim,
            fichas: z.array(z.object({ titulo: z.string(), afirmaciones: z.array(Claim) })).describe('Secciones adecuadas a la materia: ubicación, funciones, características, importancia, ejemplos, consecuencias…'),
          }),
        )
        .describe('Conceptos, estructuras, componentes y procesos importantes del documento (máx. 40).'),
      relaciones: z.array(z.object({ origen: z.string(), destino: z.string(), tipo: z.string().describe('Verbo corto: "forma parte de", "produce", "regula"…'), explicacion: Claim })),
      escenas: z.array(z.object({ temaId: z.string(), sceneTypeId: z.string() })).describe('Solo ids del catálogo y solo cuando la representación sea realmente adecuada al tema.'),
    });
    const r = await this.call(
      schema,
      `Analiza el documento y devuelve su estructura para una experiencia de aprendizaje visual.

TEMAS DETECTADOS (id | nivel | título):
${temas}

CATÁLOGO DE REPRESENTACIONES VISUALES (id | título | tipo):
${catalogo}

DOCUMENTO (cada bloque empieza con su id):
${text}`,
      32000,
    );
    onProgress?.(0.9, 'Verificando las citas contra el documento');
    return verifyPlan(mergeEnrichment(plan, r, doc, this.id), doc);
  }

  async explain(doc: DocumentModel, plan: StudyPlan, nombres: string[], contexto: string): Promise<Ficha[]> {
    const { text } = docForPrompt(doc);
    const schema = z.object({
      mencionado: z.boolean().describe('¿El documento menciona este elemento?'),
      fichas: z.array(z.object({ titulo: z.string(), afirmaciones: z.array(Claim) })),
    });
    const r = await this.call(
      schema,
      `El estudiante seleccionó el elemento «${nombres[0]}» (también llamado: ${nombres.slice(1).join(', ') || '—'}) en ${contexto}.
Materia: ${plan.dominio.materia}. Tema: ${plan.dominio.tema}.
Crea una ficha con secciones adecuadas a la materia (por ejemplo: ¿Qué es?, Ubicación, Características, Funciones, Relación con otros elementos, Importancia en el tema, ¿Qué sucede si se altera?, Ejemplos, Datos importantes del documento).
Primero lo que dice el documento (con citas literales); después, si aporta valor, información complementaria marcada como tal. No incluyas secciones vacías.

DOCUMENTO:
${text}`,
    );
    return r.fichas.map((f) => ({ titulo: f.titulo, afirmaciones: f.afirmaciones.map((c) => verifyAfirmacion(toAfirmacion(c), doc)) }));
  }

  async ask(doc: DocumentModel, plan: StudyPlan, scope: Parameters<AIProvider['ask']>[2], question: string, history: Parameters<AIProvider['ask']>[4]): Promise<TutorAnswer> {
    const temaTitulo = scope.temaId ? plan.temas.find((t) => t.id === scope.temaId)?.titulo : undefined;
    const { text, truncated } = docForPrompt(doc);
    const schema = z.object({
      segun_documento: z.array(z.object({ texto: z.string(), cita: z.string() })).describe('Lo que responde el documento, cada punto con su cita literal.'),
      informacion_adicional: z.array(z.object({ texto: z.string() })).describe('Conocimiento general que complementa (vacío si no hace falta).'),
      insuficiente: z.boolean().describe('true si el documento no contiene información suficiente para responder.'),
    });
    const hist = history.slice(-6).map((m) => `${m.role === 'user' ? 'Estudiante' : 'Tutor'}: ${m.text}`).join('\n');
    const r = await this.call(
      schema,
      `Eres un tutor. Responde la pregunta del estudiante basándote primero en el documento.
Contexto de la pregunta: ${scope.tipo} «${scope.titulo}»${temaTitulo ? ` dentro del tema «${temaTitulo}»` : ''}${scope.nombres?.length ? ` (nombres: ${scope.nombres.join(', ')})` : ''}.
${hist ? `Conversación previa:\n${hist}\n` : ''}
Pregunta: ${question}

DOCUMENTO:
${text}`,
    );
    return {
      documento: r.segun_documento.map((p) => verifyAfirmacion({ texto: p.texto, origen: 'documento', cita: p.cita }, doc)),
      adicional: r.informacion_adicional.map((p) => ({ texto: p.texto, origen: 'complementario' as const })),
      insuficiente: r.insuficiente,
      nota: truncated ? 'El documento es muy extenso: solo se envió la primera parte a la IA.' : undefined,
    };
  }

  async generateQuestions(doc: DocumentModel, plan: StudyPlan, temaId: string | undefined, count: number): Promise<GeneratedQuestion[]> {
    const restrict = temaId ? new Set(plan.temas.filter((t) => subtree(temaId, plan.temas).has(t.id)).flatMap((t) => [...t.blockIds])) : undefined;
    const { text } = docForPrompt(doc, restrict);
    const schema = z.object({
      preguntas: z.array(
        z.object({
          tipo: z.enum(['opcion-multiple', 'verdadero-falso', 'abierta']),
          pregunta: z.string(),
          opciones: z.array(z.string()).describe('4 opciones para opción múltiple; ["Verdadero","Falso"] para verdadero/falso; vacío para abierta.'),
          correcta: z.number().describe('Índice de la opción correcta (0 en abiertas).'),
          respuesta: z.string().describe('Respuesta correcta redactada.'),
          cita: z.string().describe('Cita literal del documento que respalda la respuesta.'),
          explicacion: z.string(),
        }),
      ),
    });
    const r = await this.call(schema, `Genera ${count} preguntas de estudio variadas (opción múltiple, verdadero/falso y abiertas) basadas EXCLUSIVAMENTE en este material. Cada respuesta debe tener su cita literal.\n\nMATERIAL:\n${text}`);
    return r.preguntas.map((q) => ({
      tipo: q.tipo,
      pregunta: q.pregunta,
      opciones: q.opciones.length ? q.opciones : undefined,
      correcta: q.correcta,
      explicacion: q.explicacion,
      respuestaModelo: verifyAfirmacion({ texto: q.respuesta, origen: 'documento', cita: q.cita }, doc),
    }));
  }

  async gradeOpen(pregunta: string, esperada: string, respuesta: string): Promise<OpenGrade> {
    const schema = z.object({ resultado: z.enum(['correcta', 'parcial', 'incorrecta']), comentario: z.string() });
    return this.call(schema, `Evalúa la respuesta de un estudiante.\nPregunta: ${pregunta}\nRespuesta esperada (del documento): ${esperada}\nRespuesta del estudiante: ${respuesta}\nDa un comentario breve y constructivo.`, 2000);
  }

  async summarize(doc: DocumentModel, plan: StudyPlan, temaId: string): Promise<Afirmacion[]> {
    const ids = subtree(temaId, plan.temas);
    const { text } = docForPrompt(doc, new Set(plan.temas.filter((t) => ids.has(t.id)).flatMap((t) => t.blockIds)));
    const schema = z.object({ puntos: z.array(z.object({ texto: z.string(), cita: z.string() })) });
    const r = await this.call(schema, `Resume esta sección en 3 a 7 puntos fieles al texto, cada uno con la cita literal que lo respalda.\n\nSECCIÓN:\n${text}`, 4000);
    return r.puntos.map((p) => {
      const v = verifyAfirmacion({ texto: p.texto, origen: 'documento', cita: p.cita }, doc);
      // un resumen es redacción de la IA: se marca como "generado", conservando el enlace a la cita si es real
      return v.verificada ? { ...v, origen: 'generado' as const } : v;
    });
  }
}

type Enrichment = {
  materia: string;
  tema: string;
  resumenes: { temaId: string; puntos: ClaimT[] }[];
  conceptos: { nombre: string; tipo: Concepto['tipo']; temaId: string; definicion: ClaimT; fichas: { titulo: string; afirmaciones: ClaimT[] }[] }[];
  relaciones: { origen: string; destino: string; tipo: string; explicacion: ClaimT }[];
  escenas: { temaId: string; sceneTypeId: string }[];
};

/** Fusiona el análisis de Claude con el local sin perder nada del local. */
export function mergeEnrichment(plan: StudyPlan, r: Enrichment, doc: DocumentModel, proveedor: StudyPlan['proveedor'] = 'claude'): StudyPlan {
  const temaIds = new Set(plan.temas.map((t) => t.id));
  const conceptos = plan.conceptos.map((c) => ({ ...c, definicion: [...c.definicion], fichas: [...c.fichas] }));
  const byName = new Map(conceptos.map((c) => [normalize(c.nombre), c]));
  for (const c of r.conceptos.slice(0, 60)) {
    const key = normalize(c.nombre);
    const def = toAfirmacion(c.definicion);
    const fichas = c.fichas.filter((f) => f.afirmaciones.length).map((f) => ({ titulo: f.titulo, afirmaciones: f.afirmaciones.map(toAfirmacion) }));
    const ex = byName.get(key);
    if (ex) {
      ex.tipo = c.tipo;
      if (!ex.definicion.some((d) => normalize(d.texto) === normalize(def.texto))) ex.definicion.push(def);
      ex.fichas.push(...fichas);
    } else {
      let id = slug(c.nombre);
      while (conceptos.some((x) => x.id === id)) id += '-2';
      const n: Concepto = {
        id,
        nombre: c.nombre,
        alias: [],
        temaId: temaIds.has(c.temaId) ? c.temaId : plan.temas[0]?.id ?? 'documento',
        tipo: c.tipo,
        definicion: [def],
        fichas,
        menciones: doc.blocks.filter((b) => normalize(b.text).includes(key)).map((b) => b.id).slice(0, 30),
      };
      conceptos.push(n);
      byName.set(key, n);
    }
  }
  const relaciones = [...plan.relaciones];
  for (const rel of r.relaciones) {
    const a = byName.get(normalize(rel.origen));
    const b = byName.get(normalize(rel.destino));
    if (!a || !b || a.id === b.id) continue;
    const id = `rel-ai-${a.id}-${b.id}`;
    if (relaciones.some((x) => x.id === id)) continue;
    relaciones.push({ id, origenId: a.id, destinoId: b.id, tipo: rel.tipo, afirmacion: toAfirmacion(rel.explicacion) });
  }
  const temas = plan.temas.map((t) => {
    const s = r.resumenes.find((x) => x.temaId === t.id);
    if (!s) return t;
    return { ...t, resumen: s.puntos.map((p) => (p.origen === 'documento' ? { texto: p.texto, origen: 'documento' as const, cita: p.cita } : { texto: p.texto, origen: 'generado' as const })) };
  });
  const escenas = [...plan.escenas];
  for (const e of r.escenas) {
    const entry = getEntry(e.sceneTypeId);
    if (!entry || entry.id.startsWith('generico.') || !temaIds.has(e.temaId)) continue;
    if (escenas.some((x) => x.temaId === e.temaId && x.sceneTypeId === e.sceneTypeId)) continue;
    // Los generadores con parámetros detectados (moléculas, red, sólidos) solo se añaden si el análisis local los detectó.
    if (entry.detect) continue;
    const idx = escenas.findIndex((x) => x.temaId === e.temaId);
    const nueva = { id: `${e.temaId}::${entry.id}::ai${escenas.length}`, temaId: e.temaId, sceneTypeId: entry.id, titulo: entry.titulo, confianza: 5, params: {} };
    if (idx === -1) escenas.push(nueva);
    else escenas.splice(idx, 0, nueva);
  }
  return {
    ...plan,
    proveedor,
    dominio: { materia: r.materia || plan.dominio.materia, tema: r.tema || plan.dominio.tema, confianza: 0.9 },
    temas,
    conceptos,
    relaciones,
    escenas,
  };
}

/** Claude (Anthropic) con el SDK oficial y salida estructurada. */
export class ClaudeProvider extends LLMProvider {
  id = 'claude' as const;
  nombre = 'Claude';
  private client: Anthropic;

  constructor(apiKey: string, private model = DEFAULT_MODEL) {
    super();
    // La clave pertenece al usuario, se escribe en esta sesión y solo vive en memoria.
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  }

  protected async call<T extends z.ZodType>(schema: T, user: string, maxTokens = 16000): Promise<z.infer<T>> {
    try {
      const res = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        system: SYSTEM,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content: user }],
        output_config: { format: betaZodOutputFormat(schema) },
      });
      if (res.stop_reason === 'refusal') throw new ClaudeError('El modelo declinó responder a esta petición.');
      if (res.stop_reason === 'max_tokens') throw new ClaudeError('La respuesta fue demasiado larga y quedó incompleta. Prueba con un tema más concreto.');
      if (!res.parsed_output) throw new ClaudeError('La respuesta de la IA no tenía el formato esperado.');
      return res.parsed_output as z.infer<T>;
    } catch (e) {
      if (e instanceof ClaudeError) throw e;
      throw explainError(e);
    }
  }
}

export { SYSTEM as SYSTEM_PROMPT };
