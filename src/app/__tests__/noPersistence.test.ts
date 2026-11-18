import { globSync, readFileSync } from 'node:fs';

test('el código de la aplicación no usa ningún almacenamiento persistente', () => {
  const prohibido = /\b(localStorage|sessionStorage|indexedDB|document\.cookie|caches\.open)\b|zustand\/middleware/;
  const archivos = globSync('src/**/*.{ts,tsx}').filter((f) => !/\.test\.tsx?$/.test(f));
  expect(archivos.length).toBeGreaterThan(30);
  for (const f of archivos) expect(readFileSync(f, 'utf8'), f).not.toMatch(prohibido);
});

test('no hay claves de API en el código', () => {
  const archivos = globSync('src/**/*.{ts,tsx}');
  for (const f of archivos) expect(readFileSync(f, 'utf8'), f).not.toMatch(/sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/);
});
