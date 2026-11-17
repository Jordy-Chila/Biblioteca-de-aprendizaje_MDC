import type { DocumentModel } from '../../../types/document';
import { normalize, tokens } from '../../../utils/normalize';

/** Léxico mínimo por materia para clasificar sin IA. */
export const MATERIAS: Record<string, string[]> = {
  'Medicina y anatomía': ['anatomia', 'organo', 'tejido', 'paciente', 'clinico', 'clinica', 'sintoma', 'diagnostico', 'tratamiento', 'hueso', 'musculo', 'cerebro', 'corazon', 'sangre', 'arteria', 'vena', 'utero', 'parto', 'feto', 'pelvis', 'obstetricia', 'hormona', 'lesion', 'neurona', 'lobulo', 'cortex', 'pulmon', 'higado', 'rinon', 'enfermedad', 'medico', 'salud'],
  Biología: ['celula', 'celular', 'adn', 'arn', 'gen', 'genes', 'proteina', 'organismo', 'especie', 'mitocondria', 'nucleo', 'membrana', 'ribosoma', 'evolucion', 'ecosistema', 'bacteria', 'virus', 'fotosintesis', 'mitosis', 'meiosis', 'cromosoma', 'enzima'],
  Química: ['atomo', 'molecula', 'enlace', 'covalente', 'ionico', 'electron', 'proton', 'neutron', 'reaccion', 'compuesto', 'elemento', 'tabla periodica', 'acido', 'base', 'ph', 'mol', 'oxidacion', 'valencia', 'orbital', 'isotopo'],
  Física: ['fuerza', 'masa', 'velocidad', 'aceleracion', 'energia', 'newton', 'movimiento', 'gravedad', 'friccion', 'circuito', 'corriente', 'voltaje', 'resistencia', 'onda', 'frecuencia', 'campo', 'potencia', 'trabajo', 'inercia', 'cinematica', 'dinamica'],
  Matemáticas: ['funcion', 'ecuacion', 'derivada', 'integral', 'geometria', 'triangulo', 'circulo', 'esfera', 'cubo', 'cilindro', 'cono', 'piramide', 'prisma', 'poliedro', 'vector', 'matriz', 'teorema', 'volumen', 'area', 'angulo', 'plano', 'coordenada'],
  Historia: ['siglo', 'imperio', 'guerra', 'revolucion', 'civilizacion', 'rey', 'dinastia', 'colonia', 'independencia', 'batalla', 'tratado', 'antigua', 'medieval', 'conquista', 'republica', 'reino'],
  'Geografía y geología': ['continente', 'oceano', 'montana', 'rio', 'clima', 'relieve', 'placa', 'tectonica', 'volcan', 'corteza', 'manto', 'sismo', 'erosion', 'sedimentaria', 'roca', 'mineral', 'latitud', 'longitud', 'region'],
  Informática: ['computador', 'computadora', 'procesador', 'cpu', 'memoria', 'ram', 'software', 'hardware', 'red', 'servidor', 'protocolo', 'base de datos', 'algoritmo', 'programa', 'router', 'switch', 'tcp', 'internet', 'sistema operativo', 'almacenamiento', 'osi', 'cliente'],
  Astronomía: ['planeta', 'estrella', 'galaxia', 'sistema solar', 'orbita', 'sol', 'luna', 'cometa', 'asteroide', 'universo', 'nebulosa'],
};

export function classifyDomain(doc: DocumentModel): { materia: string; tema: string; confianza: number } {
  const text = normalize(doc.canonicalText);
  const toks = tokens(doc.canonicalText);
  const bag = new Map<string, number>();
  toks.forEach((t) => bag.set(t, (bag.get(t) ?? 0) + 1));
  let best = { materia: 'General', score: 0 };
  let total = 0;
  for (const [materia, words] of Object.entries(MATERIAS)) {
    const score = words.reduce((s, w) => s + (w.includes(' ') ? (text.split(w).length - 1) : (bag.get(w) ?? 0) + (bag.get(w + 's') ?? 0) + (bag.get(w + 'es') ?? 0)), 0);
    total += score;
    if (score > best.score) best = { materia, score };
  }
  const confianza = total ? Math.round((best.score / total) * 100) / 100 : 0;
  return { materia: best.score >= 3 ? best.materia : 'General', tema: guessMainTopic(doc), confianza };
}

/** Tema principal: título inicial (primer bloque corto antes del primer título) o primer título o nombre del archivo. */
export function guessMainTopic(doc: DocumentModel): string {
  const firstHeadingIdx = doc.blocks.findIndex((b) => b.type === 'heading');
  const preface = doc.blocks.slice(0, firstHeadingIdx === -1 ? 3 : firstHeadingIdx);
  const titleLike = preface.find((b) => b.text.length >= 3 && b.text.length <= 80 && !/[.:;]$/.test(b.text));
  if (titleLike) return capitalize(titleLike.text);
  const h = doc.blocks.find((b) => b.type === 'heading' && !/^(índice|indice|contenido)/i.test(b.text));
  return h ? h.text : doc.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
}

function capitalize(s: string): string {
  return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}
