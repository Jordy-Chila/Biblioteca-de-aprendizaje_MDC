import { globSync, readFileSync } from 'node:fs';

// Único módulo autorizado a guardar en el equipo: progreso del estudio inteligente y artículos guardados de la biblioteca.
const PERMITIDO = /services[\\/]storage[\\/]persist\.ts$/;

test('solo services/storage/persist.ts usa almacenamiento persistente', () => {
  const prohibido = /\b(localStorage|sessionStorage|indexedDB|document\.cookie|caches\.open)\b|zustand\/middleware/;
  const archivos = globSync('src/**/*.{ts,tsx}').filter((f) => !/\.test\.tsx?$/.test(f) && !PERMITIDO.test(f));
  expect(archivos.length).toBeGreaterThan(30);
  for (const f of archivos) expect(readFileSync(f, 'utf8'), f).not.toMatch(prohibido);
});

test('no hay claves de API en el código', () => {
  const archivos = globSync('src/**/*.{ts,tsx}');
  for (const f of archivos) expect(readFileSync(f, 'utf8'), f).not.toMatch(/sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/);
});
