export type BlockType = 'heading' | 'paragraph' | 'list-item' | 'table' | 'note';

export interface Block {
  /** Identificador estable dentro del documento: b0, b1, ... */
  id: string;
  type: BlockType;
  /** Texto del bloque. En tablas: filas unidas con '\n' y celdas con ' | '. */
  text: string;
  /** Nivel de título (1..6). */
  level?: number;
  /** Elemento de lista numerada. */
  ordered?: boolean;
  /** Celdas de una tabla. */
  rows?: string[][];
  /** Página o diapositiva de origen (PDF, PPTX, imagen). */
  page?: number;
  /** Título más cercano por encima con nivel menor. */
  parentHeadingId?: string;
  /** Posición en DocumentModel.canonicalText. */
  start: number;
  end: number;
}

export type RawBlock = Omit<Block, 'id' | 'start' | 'end' | 'parentHeadingId'>;

export type DocumentFormat = 'docx' | 'pdf' | 'pptx' | 'txt' | 'md' | 'image';

export interface DocumentModel {
  id: string;
  name: string;
  format: DocumentFormat;
  size: number;
  /** Páginas (PDF), diapositivas (PPTX) o 1 (imagen). */
  pageCount?: number;
  blocks: Block[];
  canonicalText: string;
  /** Avisos de la extracción (p. ej. OCR con baja confianza). */
  warnings: string[];
}
