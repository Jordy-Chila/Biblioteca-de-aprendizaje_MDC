import { create } from 'zustand';
import type { V3 } from '../types/scene';

/** Estado de visualización de cada escena (en memoria). */
export interface SceneView {
  camera?: { position: V3; target: V3 };
  ocultos: string[];
  transparentes: string[];
  capasOcultas: string[];
  explode: number;
  aislado: boolean;
  /** Paso actual en procesos y líneas de tiempo. */
  paso: number;
  reproduciendo: boolean;
}

const empty = (): SceneView => ({ ocultos: [], transparentes: [], capasOcultas: [], explode: 0, aislado: false, paso: -1, reproduciendo: false });

interface ViewerState {
  views: Record<string, SceneView>;
  etiquetas: boolean;
  autoRotar: boolean;
  animar: boolean;
  /** Petición de mover la cámara (vista predefinida, reinicio o enfoque). Se incrementa `nonce` para disparar. */
  cameraRequest?: { escenaId: string; position?: V3; target?: V3; nonce: number; focusPartId?: string };
  zoomRequest?: { factor: number; nonce: number };
  zoomPct: number;
  view(escenaId: string): SceneView;
  patch(escenaId: string, p: Partial<SceneView>): void;
  toggleIn(escenaId: string, key: 'ocultos' | 'transparentes' | 'capasOcultas', id: string): void;
  reset(escenaId: string): void;
  requestCamera(r: Omit<NonNullable<ViewerState['cameraRequest']>, 'nonce'>): void;
  zoom(factor: number): void;
  set(p: Partial<Pick<ViewerState, 'etiquetas' | 'autoRotar' | 'animar' | 'zoomPct'>>): void;
  clearAll(): void;
}

export const useViewer = create<ViewerState>()((set, get) => ({
  views: {},
  etiquetas: true,
  autoRotar: false,
  animar: true,
  zoomPct: 100,
  view: (id) => get().views[id] ?? empty(),
  patch: (id, p) => set((s) => ({ views: { ...s.views, [id]: { ...(s.views[id] ?? empty()), ...p } } })),
  toggleIn: (id, key, v) =>
    set((s) => {
      const cur = s.views[id] ?? empty();
      const list = cur[key].includes(v) ? cur[key].filter((x) => x !== v) : [...cur[key], v];
      return { views: { ...s.views, [id]: { ...cur, [key]: list } } };
    }),
  reset: (id) =>
    set((s) => ({
      views: { ...s.views, [id]: empty() },
      cameraRequest: { escenaId: id, nonce: (s.cameraRequest?.nonce ?? 0) + 1 },
    })),
  requestCamera: (r) => set((s) => ({ cameraRequest: { ...r, nonce: (s.cameraRequest?.nonce ?? 0) + 1 } })),
  zoom: (factor) => set((s) => ({ zoomRequest: { factor, nonce: (s.zoomRequest?.nonce ?? 0) + 1 } })),
  set: (p) => set(p),
  clearAll: () => set({ views: {}, cameraRequest: undefined, zoomRequest: undefined }),
}));
