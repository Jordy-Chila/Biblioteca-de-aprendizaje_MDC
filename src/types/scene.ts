import type { DocumentModel } from './document';
import type { Escena, StudyPlan, Tema } from './plan';

export type V3 = [number, number, number];

export type GeometrySpec =
  | { kind: 'sphere'; r: number; phiStart?: number; phiLength?: number; thetaStart?: number; thetaLength?: number; segments?: number }
  | { kind: 'box'; size: V3; radius?: number }
  | { kind: 'cylinder'; rTop: number; rBottom: number; h: number; segments?: number; open?: boolean }
  | { kind: 'cone'; r: number; h: number; segments?: number }
  | { kind: 'torus'; r: number; tube: number; arc?: number }
  | { kind: 'capsule'; r: number; len: number }
  | { kind: 'tube'; points: V3[]; r: number; closed?: boolean }
  | { kind: 'lathe'; points: [number, number][]; segments?: number; phiStart?: number; phiLength?: number }
  | { kind: 'ring'; inner: number; outer: number }
  /** Pared con grosor (superficie exterior + interior + caras de corte), por revolución de dos perfiles [radio, y]. */
  | { kind: 'shell'; outer: [number, number][]; inner: [number, number][]; segments?: number; phiStart?: number; phiLength?: number }
  | { kind: 'polyhedron'; type: 'tetra' | 'octa' | 'dodeca' | 'icosa'; r: number }
  | { kind: 'surface'; fn: 'paraboloide' | 'silla' | 'onda'; size: number }
  | { kind: 'arrow'; length: number; r?: number };

export interface MeshSpec {
  geom: GeometrySpec;
  /** Relieve orgánico: desplaza los vértices con ruido suave (amplitud en unidades). */
  noise?: number;
  /** Frecuencia del ruido (por defecto 2.2). */
  noiseScale?: number;
  /** Color propio de esta malla (por defecto el de la pieza). */
  color?: string;
  position?: V3;
  rotation?: V3;
  scale?: V3;
}

/** A qué apunta una pieza: el panel de información usa esta referencia. */
export type PartRef =
  | { type: 'estructura' }
  | { type: 'concepto'; id: string }
  | { type: 'paso'; procesoId: string; index: number }
  | { type: 'evento'; id: string }
  | { type: 'tema'; id: string }
  | { type: 'columna'; comparacionId: string; index: number }
  | { type: 'fila'; comparacionId: string; index: number };

export type AnimSpec =
  | { type: 'spin'; axis: V3; speed: number }
  | { type: 'orbit'; radius: number; speed: number; phase?: number; tilt?: number }
  | { type: 'pulse'; amp: number; speed: number; phase?: number }
  | { type: 'flow'; path: V3[]; speed: number; phase?: number };

export interface PartDef {
  /** Identificador único dentro del modelo. */
  id: string;
  nombre: string;
  /** Nombres alternativos para enlazar con el texto del documento. */
  alias?: string[];
  meshes: MeshSpec[];
  color: string;
  capa?: string;
  opacity?: number;
  /** Dirección de separación (explosión). Si falta se usa la dirección desde el centro. */
  explode?: V3;
  ref?: PartRef;
  selectable?: boolean;
  /** Posición de la etiqueta relativa al modelo. */
  labelAt?: V3;
  /** Etiqueta visible solo al pasar el ratón, al seleccionarla o al ocultar capas / separar el modelo (estructuras internas). */
  labelOnFocus?: boolean;
  /** Punto exacto de la pieza al que apunta la línea de la etiqueta (si falta, se calcula sobre la superficie). */
  anchorAt?: V3;
  anim?: AnimSpec;
  emissive?: string;
  /** Aspecto del material. */
  material?: 'tejido' | 'hueso' | 'membrana' | 'liquido' | 'piel' | 'metal' | 'plastico' | 'brillo';
  /** Título del artículo de Wikipedia en español para la imagen de referencia (por defecto, el nombre). */
  wiki?: string | null;
}

export interface ModelDef {
  id: string;
  titulo: string;
  tipo: 'modelo' | 'simulacion' | 'proceso' | 'mapa' | 'linea-tiempo' | 'comparacion' | 'capas' | 'jerarquia';
  parts: PartDef[];
  links?: { from: string; to: string; label?: string }[];
  camera: { position: V3; target: V3 };
  vistas?: { nombre: string; position: V3 }[];
  capas?: { id: string; nombre: string }[];
  /** Orden de reproducción para procesos y líneas de tiempo. */
  pasos?: string[];
  nota: string;
  /** Artículo de Wikipedia (español) con una imagen de referencia del modelo completo. */
  wiki?: string;
  /** Estructuras en las que se centra la escena (las demás quedan como contexto translúcido). */
  focusIds?: string[];
}

export interface SceneContext {
  plan: StudyPlan;
  doc: DocumentModel;
  tema?: Tema;
  escena: Escena;
}

export interface CatalogEntry {
  id: string;
  titulo: string;
  tipo: ModelDef['tipo'];
  materias: string[];
  /** Palabras o frases clave (normalizadas al comparar). */
  palabrasClave: string[];
  /** Al menos una de estas debe aparecer para considerar la entrada. */
  requiereAlguna?: string[];
  minScore?: number;
  /** Detección propia (generadores). Devuelve puntuación y parámetros. */
  detect?: (text: string, ctx: { plan: StudyPlan; doc: DocumentModel; tema?: Tema }) => { score: number; params?: Record<string, unknown> } | null;
  build: (ctx: SceneContext) => ModelDef | null;
}
