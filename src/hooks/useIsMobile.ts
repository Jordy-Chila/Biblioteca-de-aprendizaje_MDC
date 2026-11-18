import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

/** true en pantallas de teléfono (menos de 768 px de ancho). */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const h = () => setMobile(mq.matches);
    h();
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return Boolean(mobile);
}

/** Pantalla táctil (sin ratón): no hay "hover". */
export function isTouch(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: none)').matches);
}
