export class UnsupportedFormatError extends Error {
  constructor(name: string) {
    super(`Formato no compatible: «${name}». Usa PDF, DOCX, PPTX, TXT, MD, JPG o PNG.`);
    this.name = 'UnsupportedFormatError';
  }
}

export class UnreadableFileError extends Error {
  constructor(detail?: string) {
    super('No se pudo leer el archivo' + (detail ? ` (${detail})` : ''));
    this.name = 'UnreadableFileError';
  }
}

export class EmptyDocumentError extends Error {
  constructor(msg = 'El documento no contiene texto que se pueda analizar.') {
    super(msg);
    this.name = 'EmptyDocumentError';
  }
}
