/**
 * Imágenes de referencia e introducción desde Wikipedia en español (API REST pública, sin clave).
 * Solo se envía el nombre de la estructura del modelo, nunca el contenido del documento del usuario.
 * La caché vive en memoria y se pierde al recargar.
 */
export interface WikiSummary {
  titulo: string;
  extracto: string;
  imagen?: string;
  imagenGrande?: string;
  url: string;
}

const cache = new Map<string, Promise<WikiSummary | null>>();

export function wikiSummary(title: string): Promise<WikiSummary | null> {
  const key = title.trim();
  if (!key) return Promise.resolve(null);
  let p = cache.get(key);
  if (!p) {
    p = fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key.replace(/ /g, '_'))}`, { headers: { Accept: 'application/json' } })
      .then(async (r) => {
        if (!r.ok) return null;
        const j = await r.json();
        if (j.type === 'disambiguation' || !j.extract) return null;
        return {
          titulo: j.title as string,
          extracto: j.extract as string,
          imagen: j.thumbnail?.source as string | undefined,
          imagenGrande: (j.originalimage?.source ?? j.thumbnail?.source) as string | undefined,
          url: (j.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(key)}`) as string,
        };
      })
      .catch(() => {
        cache.delete(key); // permitir reintento si no había conexión
        return null;
      });
    cache.set(key, p);
  }
  return p;
}
