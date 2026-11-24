/**
 * ÚNICO punto de la aplicación que guarda datos en este equipo.
 * Solo se guarda lo que el usuario decide conservar: su progreso del estudio inteligente
 * (para la repetición espaciada) y los artículos que marca en la biblioteca médica.
 * Los documentos, análisis y claves de API siguen viviendo solo en memoria.
 */
export function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = window.localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

/** Devuelve false si no se pudo guardar (sin espacio o almacenamiento bloqueado). */
export function escribir(clave: string, valor: unknown): boolean {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function borrar(clave: string) {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    /* ignorar */
  }
}
