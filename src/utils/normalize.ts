/** Normaliza texto para comparar: sin diacríticos, minúsculas, comillas rectas y espacios colapsados. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Identificador estable a partir de un texto. */
export function slug(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'x';
}

/** ¿Aparece `needle` como palabra o frase completa en `haystack`? Ambos ya normalizados. */
export function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(haystack);
}

/** Palabras vacías del español y del inglés que no aportan significado al buscar. */
export const STOPWORDS = new Set(
  (
    'a al algo algun alguna algunas alguno algunos ante antes como con contra cual cuales cuando de del desde donde dos el ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue ha hay la las le les lo los mas me mi muy no nos o otra otro para pero poco por porque que quien se ser si sin sobre son su sus tambien tiene tienen todo todos tras un una uno unos y ya ' +
    'the of and or to in on for with is are be by as at an it its this that from which'
  ).split(' '),
);

/** Tokeniza texto normalizado en palabras significativas. */
export function tokens(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}
