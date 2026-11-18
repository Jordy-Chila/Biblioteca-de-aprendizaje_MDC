# SES · Laboratorio de estudio 3D

Plataforma web que convierte material de estudio (PDF, DOCX, PPTX, TXT, MD, JPG/PNG) en una experiencia visual e interactiva: modelos 3D con piezas seleccionables, procesos animados paso a paso, mapas de conceptos, líneas de tiempo, comparaciones y herramientas de estudio. Toda la información distingue si viene **del documento**, si es **complementaria** o si fue **generada por IA**.

- **100 % frontend**: React + TypeScript + Vite + Tailwind CSS + Framer Motion + Three.js / React Three Fiber / Drei.
- **Sin backend, sin base de datos, sin cuentas.**
- **Sin persistencia**: no se usa `localStorage`, `sessionStorage`, IndexedDB ni cookies. Al recargar o cerrar la pestaña todo se borra (una prueba automática lo verifica).

## Uso local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas (Vitest)
npm run build      # genera dist/
```

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub (rama `main`).
2. En **Settings → Pages → Build and deployment**, elige **Source: GitHub Actions**.
3. Cada push a `main` ejecuta `.github/workflows/pages.yml`: instala, prueba, compila y publica `dist/`.

`vite.config.ts` usa `base: './'`, así que funciona en `https://<usuario>.github.io/<cualquier-repo>/` sin cambios.

## Teléfonos (Android / iOS)

En pantallas de menos de 768 px la interfaz cambia a una versión móvil: barra de navegación inferior (Inicio, Explorar 3D, Estudio, Tutor), temas y resumen en hojas que se deslizan desde abajo, ficha de la estructura como hoja inferior que se cierra arrastrándola, barra de herramientas en una sola fila y gestos táctiles (arrastrar para girar, pellizcar para acercar). Respeta las zonas seguras (muesca, barra de inicio) y se puede añadir a la pantalla de inicio («Añadir a pantalla de inicio» en Safari o Chrome).

## Inteligencia artificial

| Modo | Qué hace | Requisitos |
|---|---|---|
| **Local** (siempre activo) | Extrae temas y subtemas (títulos), conceptos (pares término–definición en listas, párrafos y tablas), procesos (listas numeradas, secuencias con →), comparaciones (tablas), preguntas del documento, alertas, bibliografía y fechas; clasifica la materia por léxico; elige visualizaciones; tutor que devuelve los fragmentos más relevantes (BM25); flashcards, cuestionarios, evaluación y resúmenes extractivos. | Ninguno |
| **Claude** (opcional) | Clasificación fina de la materia, fichas por estructura (ubicación, funciones, consecuencias…), relaciones, tutor con respuestas redactadas, preguntas generadas, corrección de respuestas abiertas y resúmenes. | Clave de API de Anthropic que el usuario escribe en **Configuración de IA** |

- **También ChatGPT (OpenAI)**: en «Configuración de IA» se elige Claude o ChatGPT. ChatGPT usa la API de Chat Completions (`api.openai.com`) con respuesta JSON validada por los mismos esquemas; modelo por defecto `gpt-5-mini`. Ambos proveedores comparten la misma lógica (`LLMProvider`), así que el tutor, las fichas, las preguntas y la verificación de citas funcionan igual.
- **Cómo conseguir la clave**: Claude → console.anthropic.com → Billing (crédito) → API Keys → Create Key. ChatGPT → platform.openai.com → Settings → Billing → API keys → Create new secret key. Las suscripciones claude.ai / ChatGPT Plus no incluyen la API.
- La clave se guarda **solo en memoria** de la pestaña y se envía únicamente a `api.anthropic.com` (SDK oficial `@anthropic-ai/sdk` con `dangerouslyAllowBrowser`, aceptable porque la clave es del propio usuario). Nunca se incluye en el código ni en el repositorio.
- Modelo por defecto `claude-opus-5-5` (seleccionable: Sonnet 5.5, Haiku 5.5). Salida estructurada validada con zod y *fallback* del servidor (`fallbacks: "default"`) activado ante rechazos.
- **Verificación de citas**: toda afirmación marcada "del documento" debe traer una cita literal que se comprueba contra el texto extraído; si no aparece, se degrada a "complementario · no verificada".
- Arquitectura de proveedores intercambiables: `src/services/ai/types.ts` (`AIProvider`). Para añadir otro proveedor, implementa esa interfaz.

## Arquitectura

```
src/
  engines/
    document-engine/        Ingesta (pdf.js, mammoth, JSZip, Tesseract), modelo común de bloques,
                            análisis local (temas, conceptos, procesos, preguntas, alertas, fechas) y verificación de citas
    visualization-engine/   Catálogo de escenas, emparejamiento por palabras clave y modelos procedurales
    interaction-engine/     Estado visual (selección, atenuación, ocultar, transparencia, explosión) y resolución de la ficha
    education-engine/       Flashcards, cuestionarios, corrección, resúmenes, ruta guiada, búsqueda BM25
  services/ai               Proveedores local y Claude
  services/document         Cola de procesamiento de archivos
  stores/                   zustand en memoria: sesión, visor, IA, interfaz
  modules/                  dashboard, documents, ai-analysis, visual-engine, 3d-viewer, ai-tutor, learning
  pages/ layouts/ components/ hooks/ types/ utils/
```

### Catálogo de visualizaciones

- **Modelos de dominio** (procedurales, con piezas nombradas y alias para enlazarlas con el texto): cerebro, corazón, pelvis y canal del parto, útero gestante, célula eucariota, ADN, átomo, moléculas (H₂O, CO₂, CH₄, NH₃, O₂, N₂, HCl, NaCl, etanol, H₂), fuerzas en plano inclinado, circuito eléctrico, capas de la Tierra, sistema solar, componentes de una computadora, redes, cuerpos geométricos y superficies.
- **Generadores para cualquier materia**: proceso paso a paso con reproducción, línea de tiempo, comparación, mapa de conceptos y estructura del documento.
- Un modelo de dominio solo se usa si el tema supera un umbral de palabras clave (y contiene alguna palabra imprescindible). Si no, se usa una alternativa genérica: nunca se fuerza un modelo incorrecto.

- **Etiquetas con línea guía**: cada etiqueta señala con una línea y un punto la zona exacta de su estructura (en las capas, sobre la cara del corte). Hacer clic en el nombre abre su ficha.
- **Imagen de referencia real**: al seleccionar una estructura de un modelo, la ficha muestra la ilustración y el resumen del artículo de Wikipedia en español (API REST pública, sin clave), marcados como *Complementario* con enlace a la fuente. Solo se envía el nombre de la estructura, nunca el contenido del documento. Sin conexión, la sección se oculta.
- **Materiales y luz**: materiales físicos (tejido, hueso, membrana, líquido), reflejos de estudio generados localmente (sin descargar mapas HDR), relieve orgánico procedural (circunvoluciones del cerebro, lobulillos de la placenta) y paredes con grosor real en los cortes.

Para añadir un modelo: crea una `CatalogEntry` en `src/engines/visualization-engine/models/` y añádela al catálogo en `index.ts`.

## Limitaciones conocidas

- **Los modelos 3D son procedurales y esquemáticos**, generados con geometría básica de Three.js. Sirven para ubicar y relacionar estructuras; no son anatómicamente exactos. No se incluyen modelos GLB externos para no depender de recursos con licencias o tamaños incompatibles con Pages; el motor admite añadirlos como nuevas entradas del catálogo.
- El análisis local depende de la **estructura** del documento (títulos, listas, tablas, "Término: definición"). Con texto corrido sin estructura detecta menos conceptos; Claude compensa esa limitación.
- El **OCR** (imágenes y PDF escaneados) descarga el motor y los datos de idioma de Tesseract desde su CDN público la primera vez: requiere conexión. En PDF escaneados se reconocen como máximo 20 páginas.
- La corrección local de respuestas abiertas es aproximada (coincidencia de palabras clave) y así se indica.
- Con Claude, documentos de más de ~450 000 caracteres se envían truncados y se avisa.
- La información complementaria de Claude no incluye fuentes externas verificadas (no se usa búsqueda web); se marca como "Complementario".

## Pruebas

`npm test` ejecuta 18 pruebas: extracción de PDF/DOCX/PPTX/TXT, análisis del documento de ejemplo (`tests/fixtures/parto.docx`), verificación de citas, emparejamiento de escenas (pelvis y útero sí; cerebro no), construcción de todas las escenas, generación de actividades, interfaz y la garantía de que el código no usa almacenamiento persistente ni contiene claves.
