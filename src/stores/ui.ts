import { create } from 'zustand';
import type { TutorScope } from '../services/ai/types';

interface UIState {
  docRef?: { docId: string; blockId: string };
  aiSettings: boolean;
  tutorOpen: boolean;
  tutorScope?: TutorScope;
  tutorDraft?: string;
  sidebarOpen: boolean;
  toast?: { text: string; tone: 'ok' | 'error'; nonce: number };
  set(p: Partial<Omit<UIState, 'set' | 'notify' | 'openTutor'>>): void;
  notify(text: string, tone?: 'ok' | 'error'): void;
  openTutor(scope?: TutorScope, draft?: string): void;
}

export const useUI = create<UIState>()((set, get) => ({
  aiSettings: false,
  tutorOpen: false,
  sidebarOpen: false,
  set: (p) => set(p),
  notify: (text, tone = 'ok') => set({ toast: { text, tone, nonce: (get().toast?.nonce ?? 0) + 1 } }),
  openTutor: (scope, draft) => set({ tutorOpen: true, tutorScope: scope, tutorDraft: draft }),
}));
