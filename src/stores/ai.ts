import { create } from 'zustand';
import type { Ficha } from '../types/plan';
import type { AIProvider, TutorAnswer, TutorScope } from '../services/ai/types';
import { localProvider } from '../services/ai/localProvider';
import { ClaudeProvider, DEFAULT_MODEL } from '../services/ai/claudeProvider';

export interface TutorEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  scope: TutorScope;
  answer?: TutorAnswer;
  error?: string;
  pending?: boolean;
  proveedor: 'local' | 'claude';
}

interface AIState {
  /** La clave solo vive en esta variable de memoria: se pierde al recargar. */
  apiKey: string;
  model: string;
  status: 'desconectado' | 'verificando' | 'conectado' | 'error';
  error?: string;
  claude?: ClaudeProvider;
  fichas: Record<string, { loading: boolean; fichas?: Ficha[]; error?: string }>;
  tutor: Record<string, TutorEntry[]>;
  provider(): AIProvider;
  connect(apiKey: string, model: string): Promise<boolean>;
  disconnect(): void;
  setFichas(key: string, v: AIState['fichas'][string]): void;
  pushTutor(docId: string, e: TutorEntry): void;
  patchTutor(docId: string, id: string, p: Partial<TutorEntry>): void;
  clearTutor(docId: string): void;
}

export const useAI = create<AIState>()((set, get) => ({
  apiKey: '',
  model: DEFAULT_MODEL,
  status: 'desconectado',
  fichas: {},
  tutor: {},
  provider: () => (get().status === 'conectado' && get().claude ? get().claude! : localProvider),
  connect: async (apiKey, model) => {
    const key = apiKey.trim();
    if (!key) {
      set({ status: 'error', error: 'Escribe una clave de API.' });
      return false;
    }
    set({ status: 'verificando', error: undefined });
    const claude = new ClaudeProvider(key, model);
    try {
      await claude.test();
      set({ apiKey: key, model, claude, status: 'conectado' });
      return true;
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e), claude: undefined });
      return false;
    }
  },
  disconnect: () => set({ apiKey: '', claude: undefined, status: 'desconectado', error: undefined, fichas: {} }),
  setFichas: (key, v) => set((s) => ({ fichas: { ...s.fichas, [key]: v } })),
  pushTutor: (docId, e) => set((s) => ({ tutor: { ...s.tutor, [docId]: [...(s.tutor[docId] ?? []), e] } })),
  patchTutor: (docId, id, p) => set((s) => ({ tutor: { ...s.tutor, [docId]: (s.tutor[docId] ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)) } })),
  clearTutor: (docId) => set((s) => ({ tutor: { ...s.tutor, [docId]: [] } })),
}));
