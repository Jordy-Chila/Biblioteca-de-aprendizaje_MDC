import { create } from 'zustand';
import type { Ficha } from '../types/plan';
import type { AIProvider, TutorAnswer, TutorScope } from '../services/ai/types';
import { localProvider } from '../services/ai/localProvider';
import { ClaudeProvider, DEFAULT_MODEL, type LLMProvider } from '../services/ai/claudeProvider';
import { OpenAIProvider } from '../services/ai/openaiProvider';

export type ProveedorExterno = 'claude' | 'openai';

export interface TutorEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  scope: TutorScope;
  answer?: TutorAnswer;
  error?: string;
  pending?: boolean;
  proveedor: 'local' | 'claude' | 'openai';
}

interface AIState {
  /** La clave solo vive en esta variable de memoria: se pierde al recargar. */
  apiKey: string;
  model: string;
  status: 'desconectado' | 'verificando' | 'conectado' | 'error';
  error?: string;
  /** Proveedor externo conectado (Claude o ChatGPT). */
  ia?: LLMProvider;
  fichas: Record<string, { loading: boolean; fichas?: Ficha[]; error?: string }>;
  tutor: Record<string, TutorEntry[]>;
  provider(): AIProvider;
  connect(apiKey: string, model: string, proveedor?: ProveedorExterno): Promise<boolean>;
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
  provider: () => (get().status === 'conectado' && get().ia ? get().ia! : localProvider),
  connect: async (apiKey, model, proveedor = 'claude') => {
    const key = apiKey.trim();
    if (!key) {
      set({ status: 'error', error: 'Escribe una clave de API.' });
      return false;
    }
    set({ status: 'verificando', error: undefined });
    const ia: LLMProvider = proveedor === 'openai' ? new OpenAIProvider(key, model) : new ClaudeProvider(key, model);
    try {
      await ia.test();
      set({ apiKey: key, model, ia, status: 'conectado' });
      return true;
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e), ia: undefined });
      return false;
    }
  },
  disconnect: () => set({ apiKey: '', ia: undefined, status: 'desconectado', error: undefined, fichas: {} }),
  setFichas: (key, v) => set((s) => ({ fichas: { ...s.fichas, [key]: v } })),
  pushTutor: (docId, e) => set((s) => ({ tutor: { ...s.tutor, [docId]: [...(s.tutor[docId] ?? []), e] } })),
  patchTutor: (docId, id, p) => set((s) => ({ tutor: { ...s.tutor, [docId]: (s.tutor[docId] ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)) } })),
  clearTutor: (docId) => set((s) => ({ tutor: { ...s.tutor, [docId]: [] } })),
}));

/** Nombre corto del proveedor externo conectado ("Claude", "ChatGPT") o "la IA". */
export function iaNombre(): string {
  return useAI.getState().ia?.nombre ?? 'la IA';
}
