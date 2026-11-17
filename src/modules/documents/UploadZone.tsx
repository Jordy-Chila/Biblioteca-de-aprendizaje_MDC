import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FileText, FileType2, Presentation, Image as ImageIcon } from 'lucide-react';
import { ACCEPT } from '../../engines/document-engine';
import { addFiles } from '../../services/document/pipeline';
import { cx } from '../../components/ui';

export function UploadZone({ compact = false }: { compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onFiles = (fl: FileList | null) => {
    if (fl && fl.length) addFiles(fl);
    if (input.current) input.current.value = '';
  };
  return (
    <motion.div
      layout
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cx(
        'group relative overflow-hidden rounded-3xl border border-dashed transition-all',
        over ? 'border-accent bg-accent/8 shadow-[0_0_60px_-10px_rgba(34,211,238,0.5)]' : 'border-white/15 bg-white/[0.025] hover:border-accent/50',
        compact ? 'p-5' : 'p-10',
      )}
    >
      <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" id="file-input" onChange={(e) => onFiles(e.target.files)} />
      <div className={cx('flex items-center gap-6', compact ? 'flex-row' : 'flex-col text-center')}>
        <div className={cx('grid place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/30', compact ? 'size-12' : 'size-16')}>
          <UploadCloud className={compact ? 'size-6' : 'size-8'} />
        </div>
        <div className={cx('flex-1', compact ? '' : 'max-w-lg')}>
          <p className={cx('font-display text-white', compact ? 'text-base' : 'text-xl')}>Arrastra tu material de estudio aquí</p>
          <p className="mt-1 text-sm text-mist-400">PDF, DOCX, PPTX, TXT, imágenes JPG o PNG (con reconocimiento de texto). Se procesa en tu navegador: nada se sube a ningún servidor.</p>
          {!compact && (
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-[12px] text-mist-400">
              <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" /> PDF</span>
              <span className="inline-flex items-center gap-1.5"><FileType2 className="size-3.5" /> Word</span>
              <span className="inline-flex items-center gap-1.5"><Presentation className="size-3.5" /> PowerPoint</span>
              <span className="inline-flex items-center gap-1.5"><ImageIcon className="size-3.5" /> Imágenes (OCR)</span>
            </div>
          )}
        </div>
        <label htmlFor="file-input" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)] transition hover:bg-cyan-300">
          Seleccionar archivos
        </label>
      </div>
    </motion.div>
  );
}
