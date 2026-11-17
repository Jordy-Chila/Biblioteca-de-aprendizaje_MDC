import { z } from 'zod';

/**
 * Unidad de información con su procedencia.
 * - documento: extraída del material (cita literal verificada).
 * - complementario: conocimiento externo añadido por la IA (con fuentes si existen).
 * - generado: contenido elaborado por la IA a partir del documento (resúmenes, preguntas).
 */
export const AfirmacionSchema = z.object({
  texto: z.string(),
  origen: z.enum(['documento', 'complementario', 'generado']),
  cita: z.string().optional(),
  blockId: z.string().optional(),
  pagina: z.number().optional(),
  verificada: z.boolean().optional(),
  fuentes: z.array(z.object({ titulo: z.string(), url: z.string().optional() })).optional(),
});
export type Afirmacion = z.infer<typeof AfirmacionSchema>;

export const TemaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  nivel: z.number(),
  padreId: z.string().optional(),
  blockIds: z.array(z.string()),
  resumen: z.array(AfirmacionSchema),
});
export type Tema = z.infer<typeof TemaSchema>;

export const TIPOS_CONCEPTO = ['termino', 'estructura', 'proceso', 'sustancia', 'clasificacion', 'alerta', 'persona', 'evento', 'lugar'] as const;

export const FichaSchema = z.object({ titulo: z.string(), afirmaciones: z.array(AfirmacionSchema) });
export type Ficha = z.infer<typeof FichaSchema>;

export const ConceptoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  alias: z.array(z.string()),
  temaId: z.string(),
  tipo: z.enum(TIPOS_CONCEPTO),
  definicion: z.array(AfirmacionSchema),
  fichas: z.array(FichaSchema),
  /** Bloques del documento donde aparece el concepto. */
  menciones: z.array(z.string()),
});
export type Concepto = z.infer<typeof ConceptoSchema>;

export const RelacionSchema = z.object({
  id: z.string(),
  origenId: z.string(),
  destinoId: z.string(),
  tipo: z.string(),
  afirmacion: AfirmacionSchema,
});
export type Relacion = z.infer<typeof RelacionSchema>;

export const ProcesoSchema = z.object({
  id: z.string(),
  temaId: z.string(),
  nombre: z.string(),
  pasos: z.array(z.object({ nombre: z.string(), afirmacion: AfirmacionSchema })),
});
export type Proceso = z.infer<typeof ProcesoSchema>;

export const ComparacionSchema = z.object({
  id: z.string(),
  temaId: z.string(),
  columnas: z.array(z.string()),
  filas: z.array(z.array(z.string())),
  blockId: z.string(),
});
export type Comparacion = z.infer<typeof ComparacionSchema>;

export const EventoSchema = z.object({
  id: z.string(),
  temaId: z.string(),
  fecha: z.string(),
  orden: z.number(),
  afirmacion: AfirmacionSchema,
});
export type Evento = z.infer<typeof EventoSchema>;

export const EscenaSchema = z.object({
  id: z.string(),
  temaId: z.string(),
  sceneTypeId: z.string(),
  titulo: z.string(),
  /** Puntuación del emparejamiento con el catálogo (0 = alternativa). */
  confianza: z.number(),
  params: z.record(z.string(), z.unknown()),
});
export type Escena = z.infer<typeof EscenaSchema>;

export const PreguntaSchema = z.object({
  id: z.string(),
  temaId: z.string(),
  pregunta: z.string(),
  respuesta: AfirmacionSchema,
  generada: z.boolean(),
});
export type Pregunta = z.infer<typeof PreguntaSchema>;

export const StudyPlanSchema = z.object({
  documentId: z.string(),
  proveedor: z.enum(['local', 'claude']),
  dominio: z.object({ materia: z.string(), tema: z.string(), confianza: z.number() }),
  temas: z.array(TemaSchema),
  conceptos: z.array(ConceptoSchema),
  relaciones: z.array(RelacionSchema),
  procesos: z.array(ProcesoSchema),
  comparaciones: z.array(ComparacionSchema),
  eventos: z.array(EventoSchema),
  escenas: z.array(EscenaSchema),
  preguntas: z.array(PreguntaSchema),
  alertas: z.array(AfirmacionSchema),
  fuentes: z.array(AfirmacionSchema),
});
export type StudyPlan = z.infer<typeof StudyPlanSchema>;
