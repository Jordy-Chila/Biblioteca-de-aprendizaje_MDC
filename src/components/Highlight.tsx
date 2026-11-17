import { useMemo, type ReactNode } from 'react';
import type { Concepto, StudyPlan } from '../types/plan';
import { normalize } from '../utils/normalize';

/** Resalta en un texto los conceptos del plan (palabras importantes) y permite abrirlos. */
export function Highlight({ text, plan, onConcept, exclude }: { text: string; plan: StudyPlan; onConcept(c: Concepto): void; exclude?: string }) {
  const parts = useMemo(() => {
    const cands = plan.conceptos.filter((c) => c.id !== exclude && c.nombre.length >= 4).sort((a, b) => b.nombre.length - a.nombre.length).slice(0, 120);
    const norm = normalize(text);
    // normalize() conserva la longitud salvo en diacríticos combinados: trabajamos sobre una copia sin tildes de igual longitud
    const flat = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (flat.length !== text.length) return [text];
    const marks: { start: number; end: number; c: Concepto }[] = [];
    for (const c of cands) {
      const k = normalize(c.nombre);
      if (!norm.includes(k)) continue;
      let from = 0;
      while (from < flat.length) {
        const i = flat.indexOf(k, from);
        if (i === -1) break;
        const before = flat[i - 1], after = flat[i + k.length];
        const okB = !before || !/[a-z0-9]/.test(before), okA = !after || !/[a-z0-9]/.test(after);
        if (okB && okA && !marks.some((m) => i < m.end && i + k.length > m.start)) {
          marks.push({ start: i, end: i + k.length, c });
          break;
        }
        from = i + k.length;
      }
    }
    marks.sort((a, b) => a.start - b.start);
    const out: ReactNode[] = [];
    let pos = 0;
    marks.forEach((m, i) => {
      if (m.start > pos) out.push(text.slice(pos, m.start));
      out.push(
        <mark key={i} className="kw" role="button" tabIndex={0} title={`Abrir «${m.c.nombre}»`} onClick={() => onConcept(m.c)} onKeyDown={(e) => e.key === 'Enter' && onConcept(m.c)}>
          {text.slice(m.start, m.end)}
        </mark>,
      );
      pos = m.end;
    });
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  }, [text, plan, onConcept, exclude]);
  return <>{parts}</>;
}
