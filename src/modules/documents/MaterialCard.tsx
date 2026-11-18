import { motion } from 'framer-motion';
import { AlertCircle, Box, CheckCircle2, FileText, GraduationCap, Layers3, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, Button, IconButton, Progress, Spinner, formatBytes } from '../../components/ui';
import { useSession, type Material } from '../../stores/session';
import { useAI } from '../../stores/ai';
import { enrichWithAI } from '../../services/document/pipeline';
import { getEntry } from '../../engines/visualization-engine';
import { iaNombre } from '../../stores/ai';

const FORMATO: Record<string, string> = { pdf: 'PDF', docx: 'Word (DOCX)', pptx: 'PowerPoint (PPTX)', txt: 'Texto', md: 'Markdown', image: 'Imagen (OCR)' };

export function MaterialCard({ m }: { m: Material }) {
  const plan = useSession((s) => (m.docId ? s.plans[m.docId] : undefined));
  const openDoc = useSession((s) => s.openDoc);
  const remove = useSession((s) => s.removeMaterial);
  const vistos = useSession((s) => (m.docId ? Object.keys(s.vistos[m.docId] ?? {}).length : 0));
  const aiOn = useAI((s) => s.status === 'conectado');
  const modelos = plan ? [...new Set(plan.escenas.map((e) => e.sceneTypeId).filter((id) => !id.startsWith('generico.')))].map((id) => getEntry(id)?.titulo).filter(Boolean) : [];
  const temas = plan?.temas.filter((t) => t.nivel === 1).length ?? 0;
  const total = plan?.conceptos.length ?? 0;

  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="glass rounded-3xl p-5">
      <header className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-mist-200">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[15px] text-white" title={m.name}>
            {m.name}
          </h3>
          <p className="mt-0.5 text-[12px] text-mist-400">
            {m.format ? FORMATO[m.format] : 'Formato desconocido'} · {formatBytes(m.size)}
            {m.pageCount ? ` · ${m.pageCount} ${m.format === 'pptx' ? 'diapositivas' : 'páginas'}` : ''}
          </p>
        </div>
        <IconButton label="Quitar de la sesión" onClick={() => remove(m.id)}>
          <Trash2 className="size-4" />
        </IconButton>
      </header>

      {m.status === 'procesando' && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-[13px] text-mist-300">
            <Spinner /> {m.message}
          </div>
          <Progress value={m.progress} />
        </div>
      )}

      {m.status === 'error' && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-500/10 p-3 text-[13px] text-rose-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {m.error}
        </div>
      )}

      {m.status === 'listo' && plan && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{plan.dominio.materia}</Badge>
            <Badge tone={plan.proveedor !== 'local' ? 'gen' : 'default'}>
              {plan.proveedor !== 'local' ? <Sparkles className="size-3" /> : <CheckCircle2 className="size-3" />}
              {plan.proveedor !== 'local' ? `Analizado con ${plan.proveedor === 'openai' ? 'ChatGPT' : 'Claude'}` : 'Análisis local'}
            </Badge>
            {m.enriqueciendo && (
              <Badge tone="gen">
                <Spinner className="size-3 text-purple-300" /> {iaNombre()} mejorando el análisis…
              </Badge>
            )}
          </div>
          <p className="font-display text-lg leading-snug text-white">{plan.dominio.tema}</p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Temas', temas],
              ['Conceptos', total],
              ['Visualizaciones', plan.escenas.length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/4 py-2.5">
                <dt className="text-[11px] uppercase tracking-wider text-mist-400">{k}</dt>
                <dd className="font-display text-xl text-white">{v}</dd>
              </div>
            ))}
          </dl>
          {modelos.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-mist-300">
              <Box className="size-3.5 text-accent" /> Modelos 3D: {modelos.join(' · ')}
            </p>
          )}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-mist-400">
                <span>Exploración</span>
                <span>
                  {Math.min(vistos, total)}/{total} conceptos consultados
                </span>
              </div>
              <Progress value={Math.min(1, vistos / Math.max(1, total))} />
            </div>
          )}
          {m.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 text-[12px] text-orange-300">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
            </p>
          ))}
          {m.errorIA && (
            <p className="flex items-start gap-2 text-[12px] text-rose-300">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {m.errorIA}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Layers3 className="size-4" />} onClick={() => openDoc(m.docId!)}>
              Explorar en 3D
            </Button>
            <Button icon={<GraduationCap className="size-4" />} onClick={() => openDoc(m.docId!, undefined, 'study')}>
              Estudiar
            </Button>
            {aiOn && plan.proveedor === 'local' && !m.enriqueciendo && (
              <Button variant="outline" icon={<Sparkles className="size-4" />} onClick={() => enrichWithAI(m.id)}>
                Analizar con {iaNombre()}
              </Button>
            )}
          </div>
        </div>
      )}
    </motion.article>
  );
}
