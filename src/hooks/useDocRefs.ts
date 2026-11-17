import { useSession } from '../stores/session';
import { useUI } from '../stores/ui';

/** Abre el visor de referencias del documento en un bloque concreto. */
export function useDocRefs() {
  const docId = useSession((s) => s.activeDocId);
  return {
    openRef: (blockId: string, forDoc?: string) => {
      const d = forDoc ?? docId;
      if (d) useUI.getState().set({ docRef: { docId: d, blockId } });
    },
  };
}
