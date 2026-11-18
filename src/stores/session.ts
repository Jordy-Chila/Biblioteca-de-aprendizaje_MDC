import { create } from 'zustand';
import type { DocumentFormat, DocumentModel } from '../types/document';
import type { StudyPlan } from '../types/plan';
import { DOC_TOPIC } from '../engines/visualization-engine';

/**
 * Estado de la sesión. Vive SOLO en memoria: no se usa ningún middleware de persistencia
 * ni almacenamiento del navegador. Al recargar la página todo vuelve al estado inicial.
 */

export interface Material {
  id: string;
  name: string;
  format: DocumentFormat | null;
  size: number;
  pageCount?: number;
  status: 'procesando' | 'listo' | 'error';
  progress: number;
  message: string;
  error?: string;
  warnings: string[];
  docId?: string;
  /** Claude está mejorando el análisis en segundo plano. */
  enriqueciendo?: boolean;
  errorIA?: string;
}

export type Page = 'dashboard' | 'explorer' | 'study';

export interface Marcador {
  docId: string;
  key: string;
  titulo: string;
  temaId?: string;
  escenaId?: string;
  partId?: string;
}

export interface Selection {
  escenaId: string;
  partId: string;
}

interface SessionState {
  materials: Material[];
  documents: Record<string, DocumentModel>;
  plans: Record<string, StudyPlan>;
  page: Page;
  activeDocId?: string;
  activeTemaId?: string;
  activeEscenaId?: string;
  selection?: Selection;
  /** Claves de piezas/conceptos consultados por documento (progreso). */
  vistos: Record<string, Record<string, true>>;
  temasVisitados: Record<string, Record<string, true>>;
  marcadores: Marcador[];

  upsertMaterial(m: Partial<Material> & { id: string }): void;
  removeMaterial(id: string): void;
  setDocument(materialId: string, doc: DocumentModel, plan: StudyPlan): void;
  setPlan(docId: string, plan: StudyPlan): void;
  goto(page: Page): void;
  openDoc(docId: string, temaId?: string, page?: Page): void;
  openTema(temaId: string, escenaId?: string): void;
  openEscena(escenaId: string): void;
  select(partId?: string, key?: string): void;
  toggleMarcador(m: Marcador): void;
  markSeen(key: string): void;
  reset(): void;
}

const initial = {
  materials: [] as Material[],
  documents: {} as Record<string, DocumentModel>,
  plans: {} as Record<string, StudyPlan>,
  page: 'dashboard' as Page,
  activeDocId: undefined,
  activeTemaId: undefined,
  activeEscenaId: undefined,
  selection: undefined,
  vistos: {},
  temasVisitados: {},
  marcadores: [] as Marcador[],
};

export const useSession = create<SessionState>()((set, get) => ({
  ...initial,
  upsertMaterial: (m) =>
    set((s) => {
      const i = s.materials.findIndex((x) => x.id === m.id);
      if (i === -1) return { materials: [...s.materials, { name: '', format: null, size: 0, status: 'procesando', progress: 0, message: '', warnings: [], ...m } as Material] };
      const materials = [...s.materials];
      materials[i] = { ...materials[i], ...m };
      return { materials };
    }),
  removeMaterial: (id) =>
    set((s) => {
      const m = s.materials.find((x) => x.id === id);
      const documents = { ...s.documents };
      const plans = { ...s.plans };
      if (m?.docId) {
        delete documents[m.docId];
        delete plans[m.docId];
      }
      const leaving = m?.docId && s.activeDocId === m.docId;
      return {
        materials: s.materials.filter((x) => x.id !== id),
        documents,
        plans,
        marcadores: s.marcadores.filter((x) => x.docId !== m?.docId),
        ...(leaving ? { activeDocId: undefined, activeTemaId: undefined, activeEscenaId: undefined, selection: undefined, page: 'dashboard' as Page } : {}),
      };
    }),
  setDocument: (materialId, doc, plan) =>
    set((s) => ({
      documents: { ...s.documents, [doc.id]: doc },
      plans: { ...s.plans, [doc.id]: plan },
      materials: s.materials.map((m) => (m.id === materialId ? { ...m, docId: doc.id, pageCount: doc.pageCount, warnings: doc.warnings } : m)),
    })),
  setPlan: (docId, plan) =>
    set((s) => {
      const still = s.activeDocId === docId && s.activeEscenaId && plan.escenas.some((e) => e.id === s.activeEscenaId);
      return { plans: { ...s.plans, [docId]: plan }, ...(s.activeDocId === docId && !still ? { activeEscenaId: plan.escenas.find((e) => e.temaId === s.activeTemaId)?.id } : {}) };
    }),
  goto: (page) => set({ page }),
  openDoc: (docId, temaId, page = 'explorer') => {
    const plan = get().plans[docId];
    if (!plan) return;
    const t = temaId && temaId !== DOC_TOPIC ? temaId : (plan.temas.find((x) => x.nivel === 1)?.id ?? DOC_TOPIC);
    set({ activeDocId: docId, page, selection: undefined });
    get().openTema(t);
  },
  openTema: (temaId, escenaId) => {
    const { activeDocId, plans } = get();
    if (!activeDocId) return;
    const plan = plans[activeDocId];
    const esc = escenaId ?? plan.escenas.find((e) => e.temaId === temaId)?.id;
    set((s) => ({
      activeTemaId: temaId,
      activeEscenaId: esc,
      selection: undefined,
      temasVisitados: { ...s.temasVisitados, [activeDocId]: { ...(s.temasVisitados[activeDocId] ?? {}), [temaId]: true } },
    }));
  },
  openEscena: (escenaId) => set({ activeEscenaId: escenaId, selection: undefined }),
  select: (partId, key) => {
    const { activeEscenaId, activeDocId } = get();
    if (!partId || !activeEscenaId) return set({ selection: undefined });
    set((s) => ({
      selection: { escenaId: activeEscenaId, partId },
      vistos: activeDocId && key ? { ...s.vistos, [activeDocId]: { ...(s.vistos[activeDocId] ?? {}), [key]: true } } : s.vistos,
    }));
  },
  markSeen: (key) => {
    const { activeDocId } = get();
    if (!activeDocId) return;
    set((s) => ({ vistos: { ...s.vistos, [activeDocId]: { ...(s.vistos[activeDocId] ?? {}), [key]: true } } }));
  },
  toggleMarcador: (m) =>
    set((s) => ({
      marcadores: s.marcadores.some((x) => x.docId === m.docId && x.key === m.key) ? s.marcadores.filter((x) => !(x.docId === m.docId && x.key === m.key)) : [...s.marcadores, m],
    })),
  reset: () => set({ ...initial }),
}));
