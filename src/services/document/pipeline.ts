import { detectFormat, ingestFile } from '../../engines/document-engine';
import { localProvider } from '../ai/localProvider';
import { useSession } from '../../stores/session';
import { useAI } from '../../stores/ai';

let seq = 0;
let queue: Promise<void> = Promise.resolve();

/** Procesa archivos uno a uno (sin bloquear la interfaz) y los añade a la sesión. */
export function addFiles(files: FileList | File[]): string[] {
  const ids: string[] = [];
  for (const file of Array.from(files)) {
    const id = `mat-${++seq}`;
    ids.push(id);
    useSession.getState().upsertMaterial({ id, name: file.name, format: detectFormat(file.name), size: file.size, status: 'procesando', progress: 0, message: 'En cola' });
    queue = queue.then(() => processOne(id, file));
  }
  return ids;
}

async function processOne(id: string, file: File) {
  const S = useSession.getState;
  const update = (progress: number, message: string) => S().upsertMaterial({ id, progress, message });
  try {
    update(0.02, 'Leyendo archivo');
    const doc = await ingestFile(file, (p, m) => update(p * 0.7, m));
    if (!S().materials.some((m) => m.id === id)) return; // eliminado mientras se procesaba
    update(0.75, 'Analizando contenido');
    const plan = await localProvider.analyze(doc, (p, m) => update(0.75 + p * 0.2, m));
    S().setDocument(id, doc, plan);
    S().upsertMaterial({ id, status: 'listo', progress: 1, message: 'Análisis local completado' });
    const ai = useAI.getState();
    if (ai.status === 'conectado') void enrichWithAI(id);
  } catch (e) {
    S().upsertMaterial({ id, status: 'error', progress: 1, message: 'Error', error: e instanceof Error ? e.message : String(e) });
  }
}

/** Mejora el análisis con el proveedor externo, si está conectado. */
export async function enrichWithAI(materialId: string) {
  const S = useSession.getState;
  const m = S().materials.find((x) => x.id === materialId);
  const ai = useAI.getState();
  if (!m?.docId || ai.status !== 'conectado' || !ai.ia) return;
  const doc = S().documents[m.docId];
  const plan = S().plans[m.docId];
  if (!doc || !plan) return;
  S().upsertMaterial({ id: materialId, enriqueciendo: true, errorIA: undefined, message: `${ai.ia.nombre} está mejorando el análisis` });
  try {
    const enriched = await ai.ia.enrich(doc, plan);
    if (!S().documents[m.docId]) return;
    S().setPlan(m.docId, enriched);
    S().upsertMaterial({ id: materialId, enriqueciendo: false, message: `Análisis con ${ai.ia.nombre} completado` });
  } catch (e) {
    S().upsertMaterial({ id: materialId, enriqueciendo: false, errorIA: e instanceof Error ? e.message : String(e), message: 'Análisis local (la mejora con IA falló)' });
  }
}
