import { useEffect } from 'react';
import { useSession } from '../stores/session';

/** Advierte antes de salir si hay una sesión con materiales: al salir se pierde todo. */
export function useLeaveWarning() {
  const has = useSession((s) => s.materials.length > 0);
  useEffect(() => {
    if (!has) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [has]);
}
