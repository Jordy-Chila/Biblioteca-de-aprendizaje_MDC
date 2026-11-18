import * as THREE from 'three';

/**
 * Texturas procedurales (generadas en el navegador, sin descargas) que dan microrrelieve a los tejidos:
 * - "tejido": fibras y poros suaves (músculo, órganos).
 * - "hueso": porosidad fina.
 */
const cache = new Map<string, THREE.Texture>();

function hash(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Ruido de valor periódico (se repite sin costuras en `period`). */
function valueNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (a: number) => ((a % period) + period) % period;
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function tissueTexture(kind: 'tejido' | 'hueso' | 'piel'): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const hit = cache.get(kind);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let n = 0;
      if (kind === 'tejido') {
        // fibras orientadas + poros
        n = 0.55 * valueNoise(u * 64, v * 8, 64, 1) + 0.3 * valueNoise(u * 32, v * 32, 32, 2) + 0.15 * valueNoise(u * 96, v * 96, 96, 3);
      } else if (kind === 'hueso') {
        n = 0.5 * valueNoise(u * 48, v * 48, 48, 4) + 0.35 * valueNoise(u * 120, v * 120, 120, 5) + 0.15 * valueNoise(u * 12, v * 12, 12, 6);
      } else {
        n = 0.6 * valueNoise(u * 40, v * 40, 40, 7) + 0.4 * valueNoise(u * 140, v * 140, 140, 8);
      }
      const c = Math.round(n * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind === 'hueso' ? 3 : 2, kind === 'hueso' ? 3 : 2);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(kind, tex);
  return tex;
}
