import type { DocumentModel } from '../../types/document';
import type { Afirmacion, Ficha, StudyPlan } from '../../types/plan';

export type ProgressFn = (fraction: number, message: string) => void;

/** Contexto de una pregunta al tutor. */
export interface TutorScope {
  tipo: 'documento' | 'tema' | 'concepto' | 'pieza';
  titulo: string;
  temaId?: string;
  conceptoId?: string;
  /** Nombres y alias de la pieza 3D seleccionada. */
  nombres?: string[];
}

export interface TutorMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface TutorAnswer {
  /** Lo que dice el documento, con citas verificadas. */
  documento: Afirmacion[];
  /** Información adicional (marcada como complementaria). */
  adicional: Afirmacion[];
  /** El documento no contiene información suficiente. */
  insuficiente: boolean;
  nota?: string;
  /** Fuentes médicas consultadas en línea (MedlinePlus, PubMed, Cochrane). */
  enLinea?: import('../medical/sources').ConsultaEnLinea;
}

export interface GeneratedQuestion {
  tipo: 'opcion-multiple' | 'verdadero-falso' | 'abierta';
  pregunta: string;
  opciones?: string[];
  correcta?: number;
  respuestaModelo: Afirmacion;
  /** Concepto evaluado (para mostrarlo en 3D). */
  conceptoId?: string;
  explicacion?: string;
}

export interface OpenGrade {
  resultado: 'correcta' | 'parcial' | 'incorrecta';
  comentario: string;
}

/** Proveedor de inteligencia: el local siempre existe; los externos son opcionales. */
export interface AIProvider {
  id: 'local' | 'claude' | 'openai';
  nombre: string;
  /** Requiere conexión a un servicio externo. */
  externo: boolean;
  analyze(doc: DocumentModel, onProgress?: ProgressFn): Promise<StudyPlan>;
  /** Mejora un plan existente (solo proveedores externos). */
  enrich?(doc: DocumentModel, plan: StudyPlan, onProgress?: ProgressFn): Promise<StudyPlan>;
  /** Ficha detallada de una pieza o concepto. */
  explain?(doc: DocumentModel, plan: StudyPlan, nombres: string[], contexto: string): Promise<Ficha[]>;
  ask(doc: DocumentModel, plan: StudyPlan, scope: TutorScope, question: string, history: TutorMessage[]): Promise<TutorAnswer>;
  generateQuestions?(doc: DocumentModel, plan: StudyPlan, temaId: string | undefined, count: number): Promise<GeneratedQuestion[]>;
  gradeOpen?(pregunta: string, esperada: string, respuesta: string): Promise<OpenGrade>;
  summarize?(doc: DocumentModel, plan: StudyPlan, temaId: string): Promise<Afirmacion[]>;
}
