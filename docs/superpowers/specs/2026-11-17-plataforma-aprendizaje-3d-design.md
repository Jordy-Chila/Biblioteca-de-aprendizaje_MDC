# Plataforma de aprendizaje visual 3D — Diseño

Fecha: 2026-11-17 · Estado: borrador para aprobación

## 1. Intención

Una aplicación web donde el usuario adjunta un material de estudio (PDF, DOCX, PPTX, imagen) y, en lugar de leerlo, **lo explora**: el sistema entiende de qué trata, identifica temas, estructuras, procesos y relaciones, y los presenta como escenas 3D interactivas. Al seleccionar una pieza, esta se resalta, el resto se atenúa, el fondo se desenfoca y aparece una ficha con la información de esa pieza, **fiel al documento** y con lo complementario marcado aparte.

Caso de referencia: `Guia_completa_sobre_el_parto.docx` (obstetricia, 17 secciones, sin imágenes). Un mismo documento produce varias escenas de distinto tipo (estructura anatómica, capas, proceso paso a paso, relaciones, clasificaciones), no un único modelo.

Referencias visuales aportadas por el usuario (4 imágenes): estructura general tipo "Foresee" (capítulos y progreso a la izquierda, visor al centro, ficha con acciones IA a la derecha), enfoque con fondo desenfocado y citas numeradas tipo "Área de Broca", fichas por secciones tipo "Lóbulo frontal", y controles de transparencia / quitar pieza con leyenda de colores tipo "estructuras del cerebro".

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Cargar un documento y obtener, sin configuración, una experiencia de exploración visual adecuada a su contenido.
- Arquitectura reutilizable entre disciplinas: ninguna parte del código asume anatomía.
- Selección de piezas 3D por raycasting, con ficha dinámica ligada al documento.
- Herramientas de estudio derivadas del documento: modo libre, modo guiado, glosario, resúmenes, flashcards, cuestionario, marcadores, progreso.
- Preguntas libres sobre la pieza seleccionada (requiere Claude).

**No-objetivos**
- Backend propio, cuentas, base de datos o cualquier persistencia.
- Generar geometría 3D arbitraria con IA (texto→3D).
- Editor de modelos 3D para el usuario.

**Anti-objetivos (fracaso aunque "funcione")**
- Mostrar un modelo incorrecto o genérico (un cerebro para un documento de química). Si no hay escena adecuada, se usa la alternativa visual, nunca una forzada.
- Presentar como "del documento" información que no está en él.
- Simular que una función de IA funciona cuando no hay conexión o clave.
- Pantalla saturada: el modelo 3D es lo principal.

## 3. Restricciones (fijadas por el usuario)

- **Solo frontend**: React + TypeScript + Vite, publicado en **GitHub Pages**.
- Todo se procesa en el navegador y vive **solo en memoria** (estado de la app). Prohibido: localStorage, sessionStorage, IndexedDB, cookies, Firebase o cualquier almacenamiento. F5 / cerrar pestaña ⇒ sesión limpia.
- Sin autenticación ni registro.
- Ninguna clave o secreto en el código publicado.
- IA externa opcional, detrás de **proveedores intercambiables**; cuando una función la necesita, se indica claramente.
- Modelos 3D: incluidos en el proyecto o cargados de recursos públicos.

## 4. Enfoques considerados

| Enfoque | Qué es | Veredicto |
|---|---|---|
| **A. Catálogo de escenas (elegido)** | La app trae tipos de escena predefinidos (modelos GLB con piezas nombradas, generadores procedurales, alternativa de mapa de conceptos). El analizador devuelve un plan JSON que solo puede referenciar escenas y piezas del catálogo; cada dato lleva su cita del documento y se verifica localmente. | Elegido por el usuario. Selección fiable de piezas, fidelidad verificable, funciona con y sin IA. Coste: cobertura limitada al catálogo; crecer = añadir entradas. |
| B. IA genera código Three.js por escena | Máxima flexibilidad teórica. | Descartado: ejecutar código generado en el navegador, resultados inconsistentes, piezas sin identidad fiable, no funciona sin IA. |
| C. Buscar modelos en bibliotecas públicas en vivo (Sketchfab) | Mucha variedad. | Descartado como base: requiere clave, licencias variables, modelos sin piezas separadas. Posible extensión futura. |

**IA** — elegido por el usuario: **análisis local siempre activo + Claude opcional** con la clave de API del propio usuario, introducida en la sesión y guardada solo en memoria. Descartado: modelo de IA en el navegador (WebLLM: 2–4 GB, GPU, calidad pobre en español técnico).

## 5. Arquitectura

```
src/
  app/          Shell, layout, rutas internas (sin router de URL), store en memoria
  ingest/       Extractores por formato → DocumentModel normalizado
  analysis/     Proveedores intercambiables → StudyPlan
    local/      Heurísticas de estructura + emparejamiento con catálogo
    claude/     Llamadas a la API de Anthropic con salida estructurada
  grounding/    Verificación de citas contra el documento
  catalog/      Registro de tipos de escena (modelos, generadores, alternativa)
  viewer/       Motor 3D (React Three Fiber): selección, foco, capas, cámara
  study/        Glosario, resúmenes, flashcards, cuestionario, guiado, marcadores, progreso
  ask/          Preguntas sobre la pieza seleccionada
  ui/           Componentes visuales compartidos (tokens de diseño, paneles)
public/models/  GLB comprimidos + manifiestos de piezas + créditos
tools/          Scripts offline de preparación de modelos (no se publican)
```

### 5.1 Ingesta → `DocumentModel`

Cada formato se convierte a un modelo común: lista ordenada de **bloques** con `id`, `tipo` (título nivel n, párrafo, elemento de lista numerada/viñeta, tabla con filas y celdas, imagen, nota), texto, y su posición en un **texto canónico** (texto plano normalizado del documento completo). Los bloques conservan jerarquía (a qué título pertenecen).

| Formato | Herramienta | Notas |
|---|---|---|
| PDF | pdf.js (worker) | Títulos inferidos por tamaño/peso de fuente; tablas detectadas solo si son evidentes. |
| DOCX | mammoth → HTML → bloques | Conserva estilos de título, listas y tablas (el caso de referencia los usa). |
| PPTX | JSZip + lectura de XML de diapositivas | Cada diapositiva = sección; título de diapositiva = título. |
| Imagen | Tesseract.js (carga diferida, idioma spa+eng) | Lento; se avisa al usuario y se muestra progreso. |
| TXT / MD | directo | |

Los archivos se leen con `File`/`ArrayBuffer` y se descartan tras extraer; nada sale del navegador salvo hacia Claude si el usuario lo activa.

### 5.2 Análisis → `StudyPlan`

Interfaz común:

```ts
interface AnalysisProvider {
  id: 'local' | 'claude';
  analyze(doc: DocumentModel, catalog: CatalogIndex, onProgress): Promise<StudyPlan>;
}
```

Ambos proveedores producen el **mismo esquema** (`StudyPlan`, validado con zod). La app nunca sabe cuál lo produjo, salvo por la marca de origen de cada dato.

**`StudyPlan` (resumen):**
- `dominio`: área detectada (p. ej. "Medicina › Obstetricia") y confianza.
- `temas[]`: árbol tema/subtema con `blockIds` de origen y resumen por sección.
- `conceptos[]`: id, nombre, alias, tipo (estructura, proceso, sustancia, clasificación, definición, alerta…), `fichas` (secciones dinámicas de la ficha: ubicación, función, características, relaciones, importancia, ejemplos…, cada una como lista de `Afirmacion`).
- `relaciones[]`: origen, destino, tipo ("produce", "forma parte de", "se confunde con"…), cada una con su `Afirmacion`.
- `procesos[]`: secuencias ordenadas de pasos (p. ej. movimientos cardinales, períodos del parto).
- `escenas[]`: id, tema, `sceneTypeId` del catálogo, parámetros, y `vinculos` pieza→concepto.
- `glosario[]`, `preguntas[]` (las del documento, marcadas como tales; las generadas, marcadas como generadas), `alertas[]` (signos de alarma: se muestran íntegras, nunca resumidas), `fuentes[]` (bibliografía del documento).

**`Afirmacion`** — la unidad de fidelidad:
```ts
{ texto: string; origen: 'documento' | 'complementario';
  cita?: string; blockId?: string;      // obligatorio si origen = documento
  verificada?: boolean;                  // lo rellena grounding/
  fuentes?: { titulo: string; url?: string }[] }  // para complementario
```

**Proveedor local** (sin IA, siempre disponible):
- Temas/subtemas desde los títulos.
- Glosario desde tablas de dos columnas término/definición y patrones "X: definición".
- Procesos desde listas numeradas y frases de secuencia ("A → B → C").
- Preguntas desde pares pregunta/respuesta del documento.
- Alertas desde palabras clave ("signos de alarma", "urgente", "emergencia").
- Conceptos desde términos en negrita, entradas de glosario y elementos de lista "Nombre: descripción".
- Escenas: puntuación de cada entrada del catálogo por coincidencia de palabras clave y alias (español e inglés) con el texto de cada tema; se elige si supera un umbral; si no, alternativa.
- Todas sus afirmaciones son citas literales ⇒ `origen: documento`.
- Limitaciones declaradas en la UI: no responde preguntas libres, no genera contenido complementario, entiende mal documentos sin estructura.

**Proveedor Claude** (opcional):
- SDK oficial `@anthropic-ai/sdk` en el navegador (`dangerouslyAllowBrowser`, aceptable porque la clave es del propio usuario y solo vive en memoria). Modelo por defecto `claude-opus-5-5`, pensamiento adaptativo, streaming, salida estructurada con el esquema `StudyPlan`.
- Se le envía el `DocumentModel` (bloques con id) y el **índice del catálogo** (ids de escena, sus piezas y para qué sirven). Instrucciones: solo puede usar ids existentes; toda afirmación de origen documento debe incluir cita literal y `blockId`; lo que añada se marca como complementario.
- Documentos largos: análisis por secciones y fusión; si excede el contexto se avisa en lugar de truncar en silencio.
- Errores (clave inválida, sin red, límite) se muestran tal cual; la app vuelve al plan local, que ya está calculado.

**Orden de ejecución:** el análisis local corre siempre primero (resultado inmediato). Si hay clave de Claude, se lanza después y su plan **enriquece** el local (más conceptos, fichas, relaciones, escenas mejor elegidas).

### 5.3 Verificación de fidelidad (`grounding/`)

Para cada `Afirmacion` con `origen: documento`: normalizar (minúsculas, sin tildes, espacios) y comprobar que `cita` aparece en el texto canónico (y preferentemente en `blockId`). Si no aparece ⇒ se degrada a `complementario` con etiqueta "no verificada en el documento". La UI distingue visualmente: **Del documento** (con enlace a la cita) / **Complementario** (con fuentes si existen).

Fuentes de lo complementario: si el usuario lo activa, Claude usa la herramienta de búsqueda web del servidor de Anthropic (`web_search`) y se citan las URLs devueltas; sin búsqueda, lo complementario se marca "sin fuente verificada". Nunca se muestran fuentes inventadas.

### 5.4 Catálogo de escenas (`catalog/`)

Cada entrada del registro:

```ts
interface SceneType {
  id: string;                          // 'anatomia.pelvis-femenina'
  kind: 'model' | 'generator' | 'fallback';
  dominios: string[];                  // ayuda al emparejamiento
  palabrasClave: string[];             // es + en
  piezas?: PartDef[];                  // para 'model'
  paramsSchema?: ZodSchema;            // para 'generator'
  load(): Promise<SceneComponent>;     // carga diferida (código + GLB)
  creditos?: Credit;                   // licencia y autor
}
interface PartDef { id: string; nombres: string[]; meshNames: string[];
  capa?: string; grupo?: string; color?: string; }
```

- **Modelos** (`kind: model`): GLB con mallas nombradas; un manifiesto JSON asocia mallas → piezas. Las piezas del catálogo se vinculan a conceptos del plan (`vinculos`).
- **Generadores** (`kind: generator`): construyen la escena a partir de parámetros del plan. Conjunto inicial:
  - `capas` — capas concéntricas o apiladas con nombre (útero: perimetrio/miometrio/endometrio; Tierra; modelo OSI).
  - `proceso` — secuencia de pasos animada sobre una escena base, con línea de tiempo (movimientos cardinales, mitosis).
  - `grafo3d` — nodos y aristas en 3D (hormonas→efectos, redes, mapas de relaciones).
  - `molecula` — átomos y enlaces (química).
  - `geometria` — sólidos y superficies de funciones (matemáticas).
  - `terreno` — malla de alturas y capas geológicas (geografía).
  - `linea-tiempo` — eventos sobre un eje 3D (historia, edad gestacional).
  - `comparacion` — tarjetas/tabla espacial lado a lado (Braxton Hicks vs. trabajo de parto).
- **Alternativa** (`kind: fallback`): mapa de conceptos 3D del tema. Se usa siempre que ninguna entrada supere el umbral de confianza.

**Contenido inicial del catálogo (v1)** — lo necesario para el caso de referencia más una prueba de generalidad:
- Modelo `anatomia.pelvis-femenina` (huesos de la pelvis + planos de los estrechos superior/medio/inferior; tejidos blandos del canal: cérvix, vagina, periné, suelo pélvico como piezas simplificadas si el modelo abierto no las trae).
- Modelo `anatomia.cerebro-lobulos` (prueba de que anatomía no está cableada a un solo modelo).
- Todos los generadores listados arriba.
- Fuente de modelos: repositorios abiertos con piezas etiquetadas (Z-Anatomy, BodyParts3D; licencia CC-BY-SA ⇒ pantalla de créditos obligatoria). Conversión offline en `tools/` con gltf-transform (nombres de malla normalizados, compresión meshopt/Draco, texturas KTX2 si las hay).

### 5.5 Visor 3D (`viewer/`)

React Three Fiber + drei (+ postprocessing para el contorno de selección).

| Requisito | Implementación |
|---|---|
| Rotar 360°, zoom, desplazar | `OrbitControls` con límites y amortiguación |
| Seleccionar pieza | Raycasting de R3F (`onPointerDown`/`onClick` por malla) → `partId` vía manifiesto |
| Resaltar / atenuar resto | Selección: emisivo + contorno; resto: opacidad y saturación reducidas (animadas) |
| Fondo desenfocado | La interfaz que rodea el visor aplica `backdrop-filter: blur` al abrir la ficha; opcional profundidad de campo en la escena |
| Ocultar / mostrar / transparente | Por pieza y por capa, desde leyenda y ficha (como la referencia 1) |
| Separar estructuras (explosión) | Desplazamiento de cada pieza desde el centro del modelo, deslizador 0–100 % |
| Cambiar perspectiva | Vistas predefinidas (anterior, lateral, superior…) por entrada del catálogo |
| Niveles de profundidad | Capas del manifiesto; corte por plano (clipping) en modelos que lo declaren |
| Identificar componentes | Etiquetas ancladas en 3D (drei `Html`) con línea guía; leyenda de colores |
| Restablecer vista | Botón que restaura cámara, visibilidad y explosión |
| Cerrar ficha sin perder posición | La cámara y el estado de la escena viven en el store; la ficha es una capa encima |

Rendimiento: GLB por escena con carga diferida y `Suspense`; liberación de geometrías/texturas al cambiar de escena; `frameloop="demand"` cuando no hay animación; límites de píxeles en pantallas de alta densidad.

### 5.6 Interfaz

Tema oscuro con un color de acento (cian, como la referencia 2), tipografía sin serifa, animaciones discretas. Disposición:

```
┌──────────┬──────────────────────────────────────┬──────────────┐
│ Menú     │  Buscador de conceptos      progreso │              │
│ ──────── │                                      │  Ficha de la │
│ Biblio-  │                                      │  pieza       │
│ teca     │           VISOR 3D                   │  (Del doc. / │
│ (sesión) │      etiquetas · leyenda             │  Complem.)   │
│ ──────── │                                      │  Acciones:   │
│ Temas y  │                                      │  preguntar,  │
│ subtemas │  [capas][ocultar][explosión][vistas] │  flashcard,  │
│ con %    │  [reset]              [−] 98 % [+]   │  marcar      │
└──────────┴──────────────────────────────────────┴──────────────┘
```

- **Biblioteca**: los documentos cargados en esta sesión (se pierden al recargar; se dice explícitamente).
- **Temas**: árbol del `StudyPlan`; cada tema abre su escena; marca de progreso.
- **Ficha**: secciones dinámicas — solo aparecen las que tienen contenido; sus títulos dependen del tipo de concepto, no de la materia cableada.
- **Paneles laterales plegables** para priorizar el visor; en pantallas pequeñas pasan a hojas inferiores.
- Pantalla de inicio limpia: "Nuevo espacio de estudio" + zona de arrastre + selector de IA (Local / Claude con campo de clave).
- Aviso discreto al intentar salir si hay una sesión activa (se perderá todo).

### 5.7 Herramientas de estudio (`study/`)

Todas se derivan del `StudyPlan` y viven en memoria:
- **Exploración libre** (por defecto) y **modo guiado** (recorrido por temas y piezas en el orden del documento, con la cámara moviéndose a cada pieza).
- **Resumen por sección**: local = primeras frases + elementos clave; Claude = resumen fiel con citas.
- **Glosario**, **flashcards** (de glosario y preguntas), **cuestionario** (preguntas del documento primero; las generadas por Claude marcadas), **evaluación** con puntuación de sesión.
- **Marcadores** de piezas/conceptos y **progreso** (piezas vistas, temas completados, aciertos), solo de sesión.
- Preguntas sobre la pieza seleccionada ("¿qué sucede si deja de funcionar?"): con Claude, respuesta separada en *Según el documento* (con citas) y *Información adicional*; sin Claude, el botón muestra los fragmentos del documento relacionados y explica que la respuesta libre requiere conectar Claude.

### 5.8 Estado y sesión

- Un store en memoria (zustand **sin** middleware de persistencia). Estructura: documentos de la sesión, `StudyPlan` por documento, escena activa, selección, estado de cámara/visibilidad por escena, progreso, marcadores, clave de API.
- La clave se introduce en un campo tipo contraseña, nunca se registra en consola ni se incluye en errores mostrados, y se borra con F5.
- Sin router basado en URL (evita problemas de rutas en GitHub Pages y no expone datos en la URL).

### 5.9 Despliegue

- Vite con `base` = nombre del repositorio; GitHub Actions construye y publica en Pages.
- Archivos de modelos < 100 MB cada uno (límite de GitHub); objetivo < 10 MB por escena.
- Créditos y licencias de modelos accesibles desde la app.

## 6. Calidad

- Pruebas unitarias (Vitest) para extractores, analizador local, verificador de citas y emparejamiento con catálogo, usando documentos de ejemplo de varias materias (incluido el caso de referencia).
- Prueba de humo en navegador: cargar el caso de referencia ⇒ aparecen temas, escena de pelvis, glosario de §15 y cuestionario de §16; seleccionar una pieza ⇒ ficha con contenido del documento.
- Verificación manual de que no se escribe nada en almacenamiento del navegador (inspección de DevTools tras una sesión).

## 7. Implementación progresiva

1. **Base**: proyecto Vite, shell de interfaz, store, ingesta (DOCX y PDF primero), analizador local, mapa de conceptos alternativo, ficha y glosario. Prueba de fin a fin con el caso de referencia.
2. **Visor y catálogo**: motor de selección/foco/capas/explosión, generadores `capas`, `proceso`, `grafo3d`, `comparacion`, `linea-tiempo`, modelo de pelvis.
3. **Claude**: proveedor, esquema estructurado, verificación de citas, preguntas sobre la pieza, búsqueda web opcional.
4. **Estudio**: modo guiado, flashcards, cuestionario, evaluación, marcadores, progreso.
5. **Ampliación**: PPTX, OCR de imágenes, generadores `molecula`, `geometria`, `terreno`, modelo de cerebro, más modelos.

## 8. Decisiones tomadas por el diseñador (revisables)

- Claude como único proveedor de IA externo en v1; la interfaz de proveedores admite añadir otros.
- Tema oscuro con acento cian; interfaz en español.
- Análisis local siempre primero; Claude enriquece.
- Búsqueda web para lo complementario: opcional y desactivada por defecto (cuesta más).
- Aviso al salir con sesión activa.
- Sin rutas de URL.
- Ficha en modo local: sin IA no se pueden inferir secciones como "Función" o "Ubicación"; la ficha muestra la definición del concepto (si existe) y los fragmentos del documento donde aparece, agrupados por sección del documento. Las secciones semánticas llegan con Claude.
- Movimientos cardinales (v1): generador `proceso` sobre la pelvis con una cabeza fetal simplificada (elipsoide orientable) que recorre los planos; no se incluye un modelo fetal completo en v1.
- PDF escaneado (sin texto): se detecta y se ofrece pasar por OCR.
- Licencia: los modelos CC-BY-SA se publican con su atribución y conservan su licencia; el código de la app puede tener otra licencia.
- Pantallas: prioridad escritorio; en tableta y móvil se usa la disposición con hojas inferiores, sin perder funciones.

## 9. A criterio del constructor

- Librería de componentes y estructura interna de carpetas dentro de cada módulo.
- Umbrales y pesos del emparejamiento con el catálogo (ajustar con los documentos de prueba).
- Detalles de animación, iluminación y materiales.
- Técnica exacta de contorno de selección y de profundidad de campo.
- Cómo simplificar los tejidos blandos del canal del parto si el modelo abierto no los incluye.
