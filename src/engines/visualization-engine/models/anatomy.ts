import type { CatalogEntry, ModelDef } from '../../../types/scene';
import { utero } from './uterus';
import { pelvis } from './pelvis';
import { corazon } from './heart';
import { both, m, PI, sph, staticModel } from './helpers';

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
        { id: 'frontal', nombre: 'Lóbulo frontal', alias: ['frontal', 'corteza prefrontal', 'area de broca', 'broca'], color: '#e0736a', capa: 'corteza', meshes: both(sph(1, [0.56, 0.75, 0.7], [0.7, 0.9, 1.05])), labelAt: [1.3, 2.15, 2.0] },
        { id: 'parietal', nombre: 'Lóbulo parietal', alias: ['parietal'], color: '#e6b35a', capa: 'corteza', meshes: both(sph(1, [0.56, 1.12, -0.6], [0.68, 0.78, 0.95])), labelAt: [1.5, 2.35, -1.0] },
        { id: 'temporal', nombre: 'Lóbulo temporal', alias: ['temporal', 'area de wernicke', 'wernicke'], color: '#6fb98f', capa: 'corteza', meshes: both(sph(1, [0.98, -0.12, 0.22], [0.42, 0.5, 0.95])), labelAt: [2.3, -0.65, 0.7] },
        { id: 'occipital', nombre: 'Lóbulo occipital', alias: ['occipital', 'corteza visual'], color: '#6a8fe0', capa: 'corteza', meshes: both(sph(1, [0.52, 0.62, -1.52], [0.6, 0.72, 0.62])), labelAt: [1.5, 1.3, -2.8] },
        { id: 'cuerpo-calloso', nombre: 'Cuerpo calloso', alias: ['calloso'], color: '#f2efe6', capa: 'profundas', labelOnFocus: true, meshes: [m({ kind: 'torus', r: 1.05, tube: 0.13, arc: PI }, [0, 0.55, -0.25], [0, PI / 2, 0], [1, 0.75, 1.25])], labelAt: [0, 1.6, 0.2] },
        { id: 'talamo', nombre: 'Tálamo', alias: ['talamo'], color: '#7cc576', capa: 'profundas', labelOnFocus: true, meshes: both(sph(0.28, [0.22, 0.25, -0.3], [1, 0.8, 1.3])), labelAt: [0.9, 0.6, -0.3] },
        { id: 'hipotalamo', nombre: 'Hipotálamo', alias: ['hipotalamo'], color: '#3fd1b0', capa: 'profundas', labelOnFocus: true, meshes: [sph(0.2, [0, -0.08, 0.15])], labelAt: [0, -0.3, 0.9] },
        { id: 'hipocampo', nombre: 'Hipocampo', alias: ['hipocampo'], color: '#ead34a', capa: 'profundas', labelOnFocus: true, meshes: both(m({ kind: 'capsule', r: 0.11, len: 0.8 }, [0.75, -0.25, -0.2], [PI / 2.3, 0, 0.25])), labelAt: [1.4, -0.7, -0.6] },
        { id: 'amigdala', nombre: 'Amígdala', alias: ['amigdala', 'amigdala cerebral'], color: '#8e2c3a', capa: 'profundas', labelOnFocus: true, meshes: both(sph(0.17, [0.72, -0.35, 0.35])), labelAt: [1.3, -0.5, 0.8] },
        { id: 'hipofisis', nombre: 'Hipófisis', alias: ['hipofisis', 'glandula pituitaria', 'pituitaria'], color: '#2b3a9e', capa: 'profundas', labelOnFocus: true, meshes: [sph(0.12, [0, -0.45, 0.3], [1, 1.2, 1])], labelAt: [0, -0.9, 0.7] },
        { id: 'cerebelo', nombre: 'Cerebelo', alias: ['cerebelo'], color: '#b07ad9', capa: 'tronco', meshes: both(sph(1, [0.42, -0.62, -1.42], [0.55, 0.42, 0.6])), labelAt: [1.7, -1.4, -2.3] },
        { id: 'tronco', nombre: 'Tronco encefálico', alias: ['tronco encefalico', 'bulbo raquideo', 'protuberancia', 'mesencefalo', 'tronco cerebral'], color: '#5b8bd6', capa: 'tronco', meshes: [m({ kind: 'cylinder', rTop: 0.32, rBottom: 0.2, h: 1.7 }, [0, -1.05, -0.55], [-0.3, 0, 0])], labelAt: [1.0, -2.2, 0.2] },
      ],
    })),
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
