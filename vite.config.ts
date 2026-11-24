/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base relativa: funciona en https://usuario.github.io/<cualquier-repo>/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // En desarrollo, MedlinePlus (sin CORS) se consulta a través de este proxy; en la app de escritorio, por IPC.
  server: { proxy: { '/proxy/medlineplus': { target: 'https://wsearch.nlm.nih.gov', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/medlineplus/, '') } } },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@react-three')) return 'r3f';
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('mammoth')) return 'mammoth';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
