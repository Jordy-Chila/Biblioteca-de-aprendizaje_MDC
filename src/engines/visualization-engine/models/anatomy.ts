import type { CatalogEntry, ModelDef } from '../../../types/scene';
import { utero } from './uterus';
import { both, curve, m, PI, sph, staticModel } from './helpers';

const MED = ['Medicina y anatomía', 'Biología'];

export const cerebro: CatalogEntry = {
  id: 'anatomia.cerebro',
  titulo: 'Cerebro',
  tipo: 'modelo',
  materias: MED,
  palabrasClave: ['cerebro', 'encefalo', 'lobulo', 'lobulo frontal', 'lobulo parietal', 'lobulo temporal', 'lobulo occipital', 'cerebelo', 'tronco encefalico', 'hipocampo', 'amigdala', 'talamo', 'hipotalamo', 'corteza cerebral', 'cuerpo calloso', 'broca', 'wernicke', 'hemisferio', 'neurona'],
  requiereAlguna: ['cerebro', 'encefalo', 'lobulo', 'cerebral', 'hemisferio'],
  build: () =>
    conRelieve(staticModel({
      id: 'anatomia.cerebro',
      titulo: 'Cerebro',
      tipo: 'modelo',
      camera: { position: [5.5, 2.2, 5.5], target: [0, 0.3, 0] },
      vistas: [
        { nombre: 'Lateral', position: [8, 0.5, 0] },
        { nombre: 'Superior', position: [0, 8, 0.01] },
        { nombre: 'Frontal', position: [0, 0.5, 8] },
        { nombre: 'Posterior', position: [0, 0.5, -8] },
      ],
      capas: [
        { id: 'corteza', nombre: 'Corteza (lóbulos)' },
        { id: 'profundas', nombre: 'Estructuras profundas' },
        { id: 'tronco', nombre: 'Cerebelo y tronco' },
      ],
      parts: [
        { id: 'frontal', nombre: 'Lóbulo frontal', alias: ['frontal', 'corteza prefrontal', 'area de broca', 'broca'], color: '#e0736a', capa: 'corteza', meshes: both(sph(1.25, [0.72, 0.65, 1.0], [0.85, 0.95, 1.25])), labelAt: [0, 1.6, 1.9] },
        { id: 'parietal', nombre: 'Lóbulo parietal', alias: ['parietal'], color: '#e6b35a', capa: 'corteza', meshes: both(sph(1.1, [0.72, 1.15, -0.65], [0.85, 0.8, 1.0])), labelAt: [0, 2.1, -0.6] },
        { id: 'temporal', nombre: 'Lóbulo temporal', alias: ['temporal', 'area de wernicke', 'wernicke'], color: '#6fb98f', capa: 'corteza', meshes: both(sph(0.95, [1.18, -0.25, 0.25], [0.6, 0.62, 1.35])), labelAt: [2.1, -0.4, 0.4] },
        { id: 'occipital', nombre: 'Lóbulo occipital', alias: ['occipital', 'corteza visual'], color: '#6a8fe0', capa: 'corteza', meshes: both(sph(0.9, [0.6, 0.45, -1.85], [0.8, 0.85, 0.85])), labelAt: [0, 0.9, -2.9] },
        { id: 'cuerpo-calloso', nombre: 'Cuerpo calloso', alias: ['calloso'], color: '#f2efe6', capa: 'profundas', meshes: [m({ kind: 'torus', r: 1.05, tube: 0.13, arc: PI }, [0, 0.55, -0.25], [0, PI / 2, 0], [1, 0.75, 1.25])], labelAt: [0, 1.6, 0.2] },
        { id: 'talamo', nombre: 'Tálamo', alias: ['talamo'], color: '#7cc576', capa: 'profundas', meshes: both(sph(0.28, [0.22, 0.25, -0.3], [1, 0.8, 1.3])), labelAt: [0.9, 0.6, -0.3] },
        { id: 'hipotalamo', nombre: 'Hipotálamo', alias: ['hipotalamo'], color: '#3fd1b0', capa: 'profundas', meshes: [sph(0.2, [0, -0.08, 0.15])], labelAt: [0, -0.3, 0.9] },
        { id: 'hipocampo', nombre: 'Hipocampo', alias: ['hipocampo'], color: '#ead34a', capa: 'profundas', meshes: both(m({ kind: 'capsule', r: 0.11, len: 0.8 }, [0.75, -0.25, -0.2], [PI / 2.3, 0, 0.25])), labelAt: [1.4, -0.7, -0.6] },
        { id: 'amigdala', nombre: 'Amígdala', alias: ['amigdala', 'amigdala cerebral'], color: '#8e2c3a', capa: 'profundas', meshes: both(sph(0.17, [0.72, -0.35, 0.35])), labelAt: [1.3, -0.5, 0.8] },
        { id: 'hipofisis', nombre: 'Hipófisis', alias: ['hipofisis', 'glandula pituitaria', 'pituitaria'], color: '#2b3a9e', capa: 'profundas', meshes: [sph(0.12, [0, -0.45, 0.3], [1, 1.2, 1])], labelAt: [0, -0.9, 0.7] },
        { id: 'cerebelo', nombre: 'Cerebelo', alias: ['cerebelo'], color: '#b07ad9', capa: 'tronco', meshes: both(sph(0.72, [0.5, -0.75, -1.55], [1, 0.62, 0.8])), labelAt: [0, -1.1, -2.5] },
        { id: 'tronco', nombre: 'Tronco encefálico', alias: ['tronco encefalico', 'bulbo raquideo', 'protuberancia', 'mesencefalo', 'tronco cerebral'], color: '#5b8bd6', capa: 'tronco', meshes: [m({ kind: 'cylinder', rTop: 0.32, rBottom: 0.2, h: 1.7 }, [0, -1.05, -0.55], [-0.3, 0, 0])], labelAt: [0, -2.0, -0.2] },
      ],
    })),
};

export const corazon: CatalogEntry = {
  id: 'anatomia.corazon',
  titulo: 'Corazón',
  tipo: 'modelo',
  materias: MED,
  palabrasClave: ['corazon', 'cardiaco', 'auricula', 'ventriculo', 'aorta', 'valvula', 'miocardio', 'arteria pulmonar', 'vena cava', 'tricuspide', 'mitral', 'circulacion', 'latido', 'sistole', 'diastole'],
  requiereAlguna: ['corazon', 'cardiaco', 'cardiaca', 'auricula', 'ventriculo'],
  build: () =>
    staticModel({
      id: 'anatomia.corazon',
      titulo: 'Corazón',
      tipo: 'modelo',
      camera: { position: [0, 1, 7], target: [0, 0.4, 0] },
      vistas: [
        { nombre: 'Anterior', position: [0, 1, 7] },
        { nombre: 'Posterior', position: [0, 1, -7] },
        { nombre: 'Lateral', position: [7, 1, 0] },
      ],
      capas: [
        { id: 'camaras', nombre: 'Cámaras' },
        { id: 'vasos', nombre: 'Grandes vasos' },
      ],
      parts: [
        { id: 'ventriculo-izquierdo', nombre: 'Ventrículo izquierdo', alias: ['ventriculo izquierdo'], color: '#c0392b', capa: 'camaras', meshes: [m({ kind: 'cone', r: 0.95, h: 2.1 }, [0.45, -0.75, 0], [PI, 0, -0.35])], anim: { type: 'pulse', amp: 0.05, speed: 6 }, labelAt: [1.6, -1.2, 0.6] },
        { id: 'ventriculo-derecho', nombre: 'Ventrículo derecho', alias: ['ventriculo derecho'], color: '#a93226', capa: 'camaras', meshes: [m({ kind: 'cone', r: 0.85, h: 1.8 }, [-0.45, -0.6, 0.35], [PI, 0, 0.3])], anim: { type: 'pulse', amp: 0.05, speed: 6 }, labelAt: [-1.6, -1.1, 0.8] },
        { id: 'auricula-izquierda', nombre: 'Aurícula izquierda', alias: ['auricula izquierda'], color: '#e74c3c', capa: 'camaras', meshes: [sph(0.62, [0.6, 0.75, -0.25], [1, 0.85, 1])], anim: { type: 'pulse', amp: 0.06, speed: 6, phase: 1.2 }, labelAt: [1.5, 1.3, -0.3] },
        { id: 'auricula-derecha', nombre: 'Aurícula derecha', alias: ['auricula derecha'], color: '#d35454', capa: 'camaras', meshes: [sph(0.66, [-0.7, 0.65, 0.15], [1, 0.9, 1])], anim: { type: 'pulse', amp: 0.06, speed: 6, phase: 1.2 }, labelAt: [-1.6, 1.2, 0.3] },
        { id: 'aorta', nombre: 'Aorta', alias: ['aorta', 'arco aortico'], color: '#e8505b', capa: 'vasos', meshes: [m({ kind: 'tube', r: 0.24, points: curve(14, (t) => [0.15 + Math.sin(t * PI) * 0.2 + t * 0.7, 0.6 + Math.sin(t * PI) * 1.4, -0.1 - t * 0.6]) }), m({ kind: 'cylinder', rTop: 0.22, rBottom: 0.22, h: 1.5 }, [0.85, -0.15, -0.7])], labelAt: [0.6, 2.3, -0.3] },
        { id: 'arteria-pulmonar', nombre: 'Arteria pulmonar', alias: ['arteria pulmonar', 'tronco pulmonar'], color: '#3d7cc9', capa: 'vasos', meshes: [m({ kind: 'tube', r: 0.2, points: curve(10, (t) => [-0.2 + t * 0.4, 0.5 + t * 1.1, 0.45 - t * 0.5]) }), m({ kind: 'cylinder', rTop: 0.13, rBottom: 0.13, h: 1.6 }, [0.15, 1.6, -0.05], [0, 0, PI / 2])], labelAt: [-0.6, 2.0, 0.6] },
        { id: 'vena-cava', nombre: 'Vena cava', alias: ['vena cava superior', 'vena cava inferior', 'vena cava'], color: '#2e5aa8', capa: 'vasos', meshes: [m({ kind: 'cylinder', rTop: 0.2, rBottom: 0.2, h: 1.4 }, [-0.95, 1.6, 0.05]), m({ kind: 'cylinder', rTop: 0.22, rBottom: 0.22, h: 1 }, [-0.85, -0.1, -0.3])], labelAt: [-1.5, 2.3, 0] },
        { id: 'venas-pulmonares', nombre: 'Venas pulmonares', alias: ['venas pulmonares'], color: '#8e6bd1', capa: 'vasos', meshes: [m({ kind: 'cylinder', rTop: 0.09, rBottom: 0.09, h: 0.9 }, [1.15, 0.95, -0.4], [0, 0, PI / 2]), m({ kind: 'cylinder', rTop: 0.09, rBottom: 0.09, h: 0.9 }, [1.15, 0.6, -0.5], [0, 0, PI / 2])], labelAt: [1.9, 0.8, -0.5] },
      ],
    }),
};

export const pelvis: CatalogEntry = {
  id: 'anatomia.pelvis',
  titulo: 'Pelvis y canal del parto',
  tipo: 'modelo',
  materias: MED,
  palabrasClave: ['pelvis', 'pelvica', 'pelvico', 'estrecho superior', 'estrecho medio', 'estrecho inferior', 'estrecho', 'sacro', 'coxis', 'iliaco', 'ilion', 'pubis', 'sinfisis', 'isquion', 'espinas ciaticas', 'suelo pelvico', 'perine', 'coxal', 'canal del parto', 'cadera'],
  requiereAlguna: ['pelvis', 'pelvica', 'pelvico', 'sacro', 'coxal', 'canal del parto', 'cadera'],
  build: () =>
    staticModel({
      id: 'anatomia.pelvis',
      titulo: 'Pelvis y canal del parto',
      tipo: 'modelo',
      camera: { position: [0, 2.5, 7.5], target: [0, 0.2, 0] },
      vistas: [
        { nombre: 'Anterior', position: [0, 1.2, 7.5] },
        { nombre: 'Superior (entrada)', position: [0, 8, 0.01] },
        { nombre: 'Lateral', position: [7.5, 0.6, 0] },
        { nombre: 'Inferior (salida)', position: [0, -8, 0.01] },
      ],
      capas: [
        { id: 'hueso', nombre: 'Pelvis ósea' },
        { id: 'planos', nombre: 'Estrechos (planos)' },
        { id: 'blandos', nombre: 'Tejidos blandos' },
      ],
      parts: [
        { id: 'coxal', nombre: 'Hueso coxal (ilion, isquion y pubis)', material: 'hueso', alias: ['coxal', 'hueso coxal', 'ilion', 'iliaco', 'hueso iliaco', 'isquion', 'cadera', 'pelvis osea'], color: '#ece4d2', capa: 'hueso', meshes: both(m({ kind: 'sphere', r: 1.35, phiStart: 0, phiLength: PI * 0.9, thetaStart: 0.35, thetaLength: 1.5 }, [1.0, 0.9, -0.2], [0.2, -0.5, -0.35], [0.9, 1.05, 0.45])).concat(both(m({ kind: 'torus', r: 0.42, tube: 0.13 }, [0.75, -0.55, 0.35], [PI / 2.4, 0.35, 0]))), labelAt: [2.4, 1.6, 0] },
        { id: 'sacro', nombre: 'Sacro', material: 'hueso', alias: ['sacro'], color: '#d9cfb8', capa: 'hueso', meshes: [m({ kind: 'cone', r: 0.62, h: 1.6, segments: 5 }, [0, 0.25, -0.95], [PI - 0.45, 0, 0], [1, 1, 0.45])], labelAt: [0, 1.3, -1.8] },
        { id: 'coxis', nombre: 'Cóccix', material: 'hueso', alias: ['coxis', 'coccix'], color: '#cbbfa5', capa: 'hueso', meshes: [m({ kind: 'cone', r: 0.16, h: 0.55 }, [0, -0.75, -0.55], [PI - 1.1, 0, 0])], labelAt: [0, -1.1, -1.3] },
        { id: 'sinfisis', nombre: 'Sínfisis del pubis', material: 'hueso', alias: ['sinfisis', 'sinfisis del pubis', 'pubis', 'arco pubico'], color: '#f4ecdc', capa: 'hueso', meshes: [m({ kind: 'box', size: [0.3, 0.55, 0.25] }, [0, -0.55, 0.85])], labelAt: [0, -0.6, 1.6] },
        { id: 'espinas-ciaticas', nombre: 'Espinas ciáticas', alias: ['espinas ciaticas', 'espina ciatica'], color: '#ffd58a', capa: 'hueso', meshes: both(m({ kind: 'cone', r: 0.09, h: 0.35 }, [0.72, -0.15, -0.15], [0, 0, PI / 2])), labelAt: [1.5, -0.1, -0.2] },
        { id: 'estrecho-superior', nombre: 'Estrecho superior', alias: ['estrecho superior', 'entrada de la pelvis', 'plano de entrada'], color: '#22d3ee', capa: 'planos', opacity: 0.45, meshes: [m({ kind: 'ring', inner: 0, outer: 1.0 }, [0, 0.45, 0.05], [-PI / 2 + 0.45, 0, 0], [1.15, 1, 1])], labelAt: [-1.9, 0.6, 0.6] },
        { id: 'estrecho-medio', nombre: 'Estrecho medio', alias: ['estrecho medio', 'plano de las espinas ciaticas'], color: '#38bdf8', capa: 'planos', opacity: 0.45, meshes: [m({ kind: 'ring', inner: 0, outer: 0.78 }, [0, -0.15, -0.1], [-PI / 2 + 0.15, 0, 0])], labelAt: [-1.9, -0.15, 0.1] },
        { id: 'estrecho-inferior', nombre: 'Estrecho inferior', alias: ['estrecho inferior', 'salida de la pelvis'], color: '#818cf8', capa: 'planos', opacity: 0.45, meshes: [m({ kind: 'ring', inner: 0, outer: 0.72 }, [0, -0.72, 0.1], [-PI / 2 - 0.2, 0, 0], [1, 1.2, 1])], labelAt: [-1.9, -0.9, 0.4] },
        { id: 'suelo-pelvico', nombre: 'Suelo pélvico', alias: ['suelo pelvico', 'piso pelvico', 'musculos del suelo pelvico'], color: '#c0605a', capa: 'blandos', opacity: 0.7, meshes: [m({ kind: 'sphere', r: 1.0, thetaStart: PI / 2, thetaLength: PI / 2 }, [0, -0.7, 0.05], [0, 0, 0], [0.95, 0.35, 0.95])], labelAt: [1.3, -1.25, 0.6] },
        { id: 'perine', nombre: 'Periné', alias: ['perine', 'perineo'], color: '#d98a7a', capa: 'blandos', meshes: [m({ kind: 'box', size: [0.45, 0.12, 0.6] }, [0, -1.1, 0.25])], labelAt: [0.7, -1.5, 0.9] },
      ],
    }),
};

export const anatomia: CatalogEntry[] = [cerebro, corazon, pelvis, utero];

/** Relieve de circunvoluciones en la corteza y aspecto de tejido en todo el encéfalo. */
function conRelieve(model: ModelDef): ModelDef {
  return {
    ...model,
    wiki: 'Encéfalo humano',
    parts: model.parts.map((p) => ({
      ...p,
      material: p.material ?? 'tejido',
      meshes: p.capa === 'corteza' || p.id === 'cerebelo' ? p.meshes.map((s) => ({ ...s, noise: p.id === 'cerebelo' ? 0.035 : 0.055, noiseScale: p.id === 'cerebelo' ? 11 : 6.5 })) : p.meshes,
    })),
  };
}
