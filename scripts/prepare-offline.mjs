/**
 * Prepara los complementos que la aplicación de escritorio incluye para funcionar sin conexión:
 *  1. Motor de OCR (Tesseract) y datos de idioma español + inglés  → public/tesseract/
 *  2. Biblioteca médica base (artículos de Wikipedia en español)    → public/medlib/base.json
 * Se ejecuta antes de empaquetar el instalador (npm run app:dist). Lo ya descargado no se repite.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const force = process.argv.includes('--force');

/* ---------- 1. OCR ---------- */
const tdir = join(pub, 'tesseract');
mkdirSync(join(tdir, 'core'), { recursive: true });
mkdirSync(join(tdir, 'lang'), { recursive: true });
copyFileSync(join(root, 'node_modules/tesseract.js/dist/worker.min.js'), join(tdir, 'worker.min.js'));
const coreDir = join(root, 'node_modules/tesseract.js-core');
for (const f of readdirSync(coreDir)) if (/^tesseract-core.*\.(js|wasm)$/.test(f)) copyFileSync(join(coreDir, f), join(tdir, 'core', f));
for (const lang of ['spa', 'eng']) {
  const out = join(tdir, 'lang', `${lang}.traineddata.gz`);
  if (existsSync(out) && statSync(out).size > 100_000 && !force) continue;
  const url = `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`;
  process.stdout.write(`OCR: descargando ${lang}… `);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar ${url} (${r.status})`);
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('ok');
}

/* ---------- 2. Biblioteca médica base ---------- */
const TEMAS = `
Medicina; Anatomía humana; Fisiología; Patología; Farmacología; Histología; Embriología humana; Bioquímica; Microbiología; Inmunología; Genética humana; Epidemiología; Semiología médica; Signo clínico; Síntoma
Célula; Tejido (biología); Órgano (biología); Sistema circulatorio humano; Corazón; Ciclo cardíaco; Electrocardiograma; Presión arterial; Sangre; Hemoglobina; Glóbulo rojo; Leucocito; Plaqueta; Coagulación; Arteria; Vena; Capilar sanguíneo
Sistema respiratorio; Pulmón; Respiración; Tráquea; Bronquio; Alvéolo pulmonar; Diafragma (anatomía)
Sistema digestivo; Estómago; Hígado; Páncreas; Intestino delgado; Intestino grueso; Vesícula biliar; Esófago; Digestión
Sistema nervioso; Encéfalo humano; Médula espinal; Neurona; Sinapsis; Sistema nervioso autónomo; Nervio; Cerebelo; Neurotransmisor
Sistema endocrino; Hormona; Hipófisis; Tiroides; Glándula suprarrenal; Insulina; Glucagón; Cortisol; Hipotálamo
Sistema urinario; Riñón; Nefrona; Vejiga urinaria; Uréter; Uretra
Sistema inmunitario; Anticuerpo; Linfocito; Vacuna; Inflamación; Antígeno
Sistema reproductor femenino; Sistema reproductor masculino; Útero; Ovario; Trompa de Falopio; Vagina; Placenta; Cordón umbilical; Líquido amniótico; Ciclo menstrual; Menstruación; Ovulación; Fecundación; Embarazo; Parto; Cesárea; Puerperio; Lactancia materna; Preeclampsia; Aborto; Ecografía obstétrica; Cuello uterino; Pelvis; Episiotomía; Hemorragia posparto; Diabetes gestacional; Control prenatal; Trabajo de parto
Sistema esquelético; Hueso; Esqueleto humano; Articulación; Sistema muscular; Músculo; Tendón; Cartílago; Columna vertebral; Cráneo
Piel; Ojo humano; Oído; Lengua (anatomía)
Hipertensión arterial; Diabetes mellitus; Diabetes mellitus tipo 1; Diabetes mellitus tipo 2; Infarto agudo de miocardio; Insuficiencia cardíaca; Arritmia cardíaca; Ateroesclerosis; Accidente cerebrovascular; Anemia; Leucemia; Cáncer; Tumor; Metástasis; Cáncer de mama; Cáncer de cuello uterino; Asma; Neumonía; Tuberculosis; Enfermedad pulmonar obstructiva crónica; Gripe; COVID-19; VIH/sida; Hepatitis; Cirrosis; Gastritis; Úlcera péptica; Apendicitis; Insuficiencia renal; Infección urinaria; Obesidad; Desnutrición; Deshidratación; Sepsis; Shock (medicina); Fiebre; Dolor; Alergia; Anafilaxia; Epilepsia; Enfermedad de Alzheimer; Enfermedad de Parkinson; Migraña; Depresión; Trastorno de ansiedad; Osteoporosis; Artritis reumatoide; Artrosis; Hipotiroidismo; Hipertiroidismo; Dengue; Malaria; Infección de transmisión sexual; Virus del papiloma humano
Antibiótico; Analgésico; Antiinflamatorio no esteroideo; Paracetamol; Ibuprofeno; Ácido acetilsalicílico; Penicilina; Corticosteroide; Anestesia; Antihipertensivo; Anticoagulante; Oxitocina; Vía de administración de fármacos; Dosis; Efecto adverso
Signos vitales; Frecuencia cardíaca; Frecuencia respiratoria; Temperatura corporal; Saturación de oxígeno; Reanimación cardiopulmonar; Primeros auxilios; Triaje; Historia clínica; Diagnóstico; Tratamiento médico; Cirugía; Enfermería; Asepsia; Esterilización (microbiología); Lavado de manos; Higiene; Salud pública; Atención primaria de salud; Nutrición; Vitamina; Agua corporal total; Glucosa; Colesterol; Hemograma; Análisis de orina; Radiografía; Tomografía axial computarizada; Resonancia magnética; Ecografía
`.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);

const outLib = join(pub, 'medlib', 'base.json');
mkdirSync(dirname(outLib), { recursive: true });
if (existsSync(outLib) && !force) {
  console.log('Biblioteca médica base ya existe (usa --force para actualizarla).');
} else {
  const API = 'https://es.wikipedia.org/w/api.php';
  const UA = { 'User-Agent': 'SES-Lab3D-offline-builder/1.0 (educational desktop app)' };
  const articulos = [];
  for (let i = 0; i < TEMAS.length; i += 1) {
    const t = TEMAS[i];
    const u = new URL(API);
    Object.entries({ action: 'query', format: 'json', formatversion: '2', redirects: '1', titles: t, prop: 'extracts|pageimages|info|categories', explaintext: '1', exsectionformat: 'wiki', piprop: 'thumbnail', pithumbsize: '320', inprop: 'url', cllimit: '30', clshow: '!hidden' }).forEach(([k, v]) => u.searchParams.set(k, v));
    try {
      let j;
      for (let intento = 0; intento < 5; intento++) {
        const r = await fetch(u, { headers: UA });
        if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
          j = await r.json();
          break;
        }
        await new Promise((ok) => setTimeout(ok, 3000 * (intento + 1))); // límite de la API: esperar y reintentar
      }
      if (!j) throw new Error('Wikipedia no respondió');
      const p = j.query?.pages?.[0];
      if (!p || p.missing || !p.extract) {
        console.log(`  · sin artículo: ${t}`);
        continue;
      }
      // quitar secciones de poco valor para estudiar
      const texto = p.extract.replace(/\n==\s*(Referencias|Véase también|Enlaces externos|Bibliografía|Notas|Lecturas recomendadas|Fuentes)\s*==[\s\S]*?(?=\n==[^=]|$)/g, '').trim();
      articulos.push({
        pageid: p.pageid,
        titulo: p.title,
        texto,
        imagen: p.thumbnail?.source,
        url: p.fullurl,
        categorias: (p.categories ?? []).map((c) => c.title.replace(/^Categoría:/, '')),
      });
      process.stdout.write(`\rBiblioteca médica: ${articulos.length}/${TEMAS.length}   `);
    } catch (e) {
      console.log(`  · error en ${t}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 900)); // ser amables con la API
  }
  writeFileSync(outLib, JSON.stringify({ generado: new Date().toISOString(), fuente: 'Wikipedia en español (CC BY-SA 4.0)', articulos }));
  console.log(`\nBiblioteca médica base: ${articulos.length} artículos guardados.`);
}
console.log('Complementos sin conexión listos.');
