import type { BlockType } from '../../types/document';

export type Nivel = 'principiante' | 'intermedio' | 'avanzado';
export type Dificultad = 'baja' | 'media' | 'alta';

export interface ConfigEstudio {
  /** Minutos que el usuario puede dedicar en una sesión (un día). */
  minutosSesion: number;
  nivel: Nivel;
  /** auto: los tiempos se calculan según el contenido; manual: se usan los indicados. */
  modoTiempos: 'auto' | 'manual';
  estudio: number;
  descanso: number;
}

export const CONFIG_DEFECTO: ConfigEstudio = { minutosSesion: 60, nivel: 'intermedio', modoTiempos: 'auto', estudio: 15, descanso: 10 };

export interface Segmento {
  blockId: string;
  tipo: BlockType;
  texto: string;
  /** Título de la sección a la que pertenece (para mostrar contexto). */
  seccion?: string;
  rows?: string[][];
}

export interface ConceptoBloque {
  key: string;
  nombre: string;
  /** Oración del propio bloque que lo define o lo explica. */
  definicion: string;
}

export interface BloqueEstudio {
  id: string;
  faseId: string;
  indice: number;
  titulo: string;
  objetivo: string;
  segmentos: Segmento[];
  conceptos: ConceptoBloque[];
  /** Preguntas que el propio documento plantea dentro de este bloque. */
  preguntasDoc: { pregunta: string; respuesta: string }[];
  palabras: number;
  dificultad: Dificultad;
  minutos: { estudio: number; prueba: number; descanso: number };
}

export interface Fase {
  id: string;
  numero: number;
  titulo: string;
  bloques: BloqueEstudio[];
  minutos: number;
}

export interface Curso {
  id: string;
  docName: string;
  titulo: string;
  creado: number;
  config: ConfigEstudio;
  fases: Fase[];
  resumen: { palabras: number; conceptos: number; dificultad: Dificultad; minutosEstudio: number; minutosTotales: number };
}

export type TipoPregunta = 'opcion-multiple' | 'verdadero-falso' | 'completar' | 'relacionar' | 'corta';

export interface PreguntaMini {
  id: string;
  tipo: TipoPregunta;
  enunciado: string;
  opciones?: string[];
  correcta?: number;
  /** Respuesta esperada en texto (completar, corta) o explicación de la correcta. */
  respuesta: string;
  /** relacionar: término → definición (el orden de definiciones se mezcla en la vista). */
  pares?: { termino: string; definicion: string; key: string }[];
  conceptKeys: string[];
  /** Fragmento del bloque en el que se basa la pregunta. */
  fuente: string;
}

export type RespuestaUsuario = number | string | Record<string, string> | undefined;

export interface ResultadoPregunta {
  preguntaId: string;
  estado: 'correcta' | 'parcial' | 'incorrecta';
  explicacion: string;
  fallados: string[];
  acertados: string[];
}

export interface ResultadoPrueba {
  nota: number; // 0..1
  resultados: ResultadoPregunta[];
  reforzar: ConceptoBloque[];
  recomendacion: 'avanzar' | 'repaso-breve' | 'repaso';
  mensaje: string;
}

export interface ProgresoBloque {
  estado: 'pendiente' | 'en-curso' | 'completado';
  intentos: { fecha: number; nota: number; fallados: string[] }[];
}

/** Tarjeta de repetición espaciada (sistema de cajas de Leitner). */
export interface Tarjeta {
  key: string;
  cursoId: string;
  bloqueId: string;
  nombre: string;
  definicion: string;
  caja: number;
  proxima: number;
  aciertos: number;
  fallos: number;
}
