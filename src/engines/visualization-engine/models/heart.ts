import type { CatalogEntry, MeshSpec, V3 } from '../../../types/scene';
import { curve, m, staticModel } from './helpers';
import { blob } from './body';

const tube = (pts: V3[], r: number, color?: string): MeshSpec => ({ ...m({ kind: 'tube', r, points: pts }), color });
const organic = (ms: MeshSpec[], noise = 0.018): MeshSpec[] => ms.map((s) => ({ ...s, noise, noiseScale: 4 }));

/** Corazón en vista anterior: ápex hacia abajo e izquierda (+x = izquierda del paciente). */
export const corazon: CatalogEntry = {
  id: 'anatomia.corazon',
  titulo: 'Corazón',
  tipo: 'modelo',
  materias: ['Medicina y anatomía', 'Biología'],
  palabrasClave: ['corazon', 'cardiaco', 'auricula', 'ventriculo', 'aorta', 'valvula', 'miocardio', 'arteria pulmonar', 'vena cava', 'tricuspide', 'mitral', 'circulacion', 'latido', 'sistole', 'diastole', 'coronaria'],
  requiereAlguna: ['corazon', 'cardiaco', 'cardiaca', 'auricula', 'ventriculo'],
  build: () =>
    staticModel({
      id: 'anatomia.corazon',
      titulo: 'Corazón (vista anterior)',
      tipo: 'modelo',
      wiki: 'Corazón humano',
      camera: { position: [0.4, 0.9, 6.6], target: [0.05, 0.3, 0] },
      vistas: [
        { nombre: 'Anterior', position: [0.4, 0.9, 6.6] },
        { nombre: 'Posterior', position: [0, 0.9, -6.6] },
        { nombre: 'Lateral izquierda', position: [6.6, 0.6, 0] },
      ],
      capas: [
        { id: 'camaras', nombre: 'Cámaras' },
        { id: 'vasos', nombre: 'Grandes vasos' },
        { id: 'coronarias', nombre: 'Arterias coronarias' },
      ],
      parts: [
        { id: 'ventriculo-izquierdo', nombre: 'Ventrículo izquierdo', alias: ['ventriculo izquierdo'], wiki: 'Ventrículo izquierdo', color: '#9e2f37', capa: 'camaras', meshes: organic(blob([[0.3, 0.3, -0.12], [0.48, -0.35, 0.0], [0.58, -0.95, 0.18], [0.6, -1.3, 0.3]], [0.74, 0.7, 0.45, 0.14], 12)), anim: { type: 'pulse', amp: 0.035, speed: 6 }, labelAt: [2.0, -1.0, 0.4] },
        { id: 'ventriculo-derecho', nombre: 'Ventrículo derecho', alias: ['ventriculo derecho'], wiki: 'Ventrículo derecho', color: '#b4433f', capa: 'camaras', meshes: organic(blob([[-0.32, 0.22, 0.32], [-0.12, -0.42, 0.44], [0.25, -0.98, 0.38]], [0.62, 0.56, 0.2], 10)), anim: { type: 'pulse', amp: 0.035, speed: 6 }, labelAt: [-1.9, -0.9, 0.9], anchorAt: [-0.1, -0.45, 0.98] },
        { id: 'auricula-izquierda', nombre: 'Aurícula izquierda', alias: ['auricula izquierda'], wiki: 'Aurícula izquierda', color: '#c65450', capa: 'camaras', meshes: organic([{ ...m({ kind: 'sphere', r: 0.48 }, [0.42, 0.78, -0.42], [0, 0, 0], [1.15, 0.85, 0.95]) }, ...blob([[0.68, 0.92, 0.0], [0.86, 0.78, 0.22]], [0.2, 0.12], 5)]), anim: { type: 'pulse', amp: 0.05, speed: 6, phase: 1.2 }, labelAt: [2.0, 1.25, -0.3] },
        { id: 'auricula-derecha', nombre: 'Aurícula derecha', alias: ['auricula derecha'], wiki: 'Aurícula derecha', color: '#cf5f58', capa: 'camaras', meshes: organic([{ ...m({ kind: 'sphere', r: 0.52 }, [-0.78, 0.52, 0.02], [0, 0, 0], [0.95, 1.05, 1]) }, ...blob([[-0.6, 0.86, 0.38], [-0.3, 0.86, 0.6]], [0.2, 0.11], 5)]), anim: { type: 'pulse', amp: 0.05, speed: 6, phase: 1.2 }, labelAt: [-2.1, 0.7, 0.5] },
        { id: 'aorta', nombre: 'Aorta', alias: ['aorta', 'arco aortico', 'cayado aortico'], wiki: 'Aorta', color: '#d9535b', capa: 'vasos', meshes: [tube([[0.02, 0.55, 0.05], [0.0, 1.2, 0.12], [0.08, 1.75, 0.0], [0.45, 2.0, -0.35], [0.75, 1.7, -0.75], [0.82, 0.9, -0.9], [0.84, -0.4, -0.95]], 0.24), tube(curve(6, (t) => [0.12, 1.85 + t * 0.6, -0.08]), 0.08), tube(curve(6, (t) => [0.36, 1.98 + t * 0.55, -0.28]), 0.07), tube(curve(6, (t) => [0.56, 1.95 + t * 0.5, -0.45]), 0.075)], labelAt: [1.3, 2.75, -0.2] },
        { id: 'arteria-pulmonar', nombre: 'Tronco y arterias pulmonares', alias: ['arteria pulmonar', 'tronco pulmonar', 'arterias pulmonares'], wiki: 'Tronco pulmonar', color: '#4a72c8', capa: 'vasos', meshes: [tube([[-0.1, 0.55, 0.62], [0.05, 1.05, 0.55], [0.3, 1.38, 0.3], [0.42, 1.48, 0.05]], 0.21), tube([[0.42, 1.48, 0.05], [0.9, 1.42, -0.1], [1.4, 1.3, -0.2]], 0.13), tube([[0.3, 1.4, 0.1], [-0.2, 1.36, -0.35], [-0.9, 1.25, -0.5]], 0.13)], labelAt: [1.9, 1.95, 0.6] },
        { id: 'vena-cava', nombre: 'Venas cavas', alias: ['vena cava superior', 'vena cava inferior', 'vena cava', 'venas cavas'], wiki: 'Vena cava superior', color: '#3456a3', capa: 'vasos', meshes: [tube([[-0.82, 0.85, -0.02], [-0.82, 1.5, -0.04], [-0.8, 2.25, -0.08]], 0.2), tube([[-0.72, 0.1, -0.12], [-0.7, -0.5, -0.2], [-0.68, -1.0, -0.24]], 0.22)], labelAt: [-2.0, 2.2, 0] },
        { id: 'venas-pulmonares', nombre: 'Venas pulmonares', alias: ['venas pulmonares'], wiki: 'Venas pulmonares', color: '#8d6ad0', capa: 'vasos', meshes: [tube([[0.75, 0.95, -0.55], [1.35, 1.05, -0.62]], 0.09), tube([[0.78, 0.62, -0.55], [1.38, 0.55, -0.62]], 0.09), tube([[0.1, 0.95, -0.72], [-0.4, 1.05, -0.95]], 0.09), tube([[0.12, 0.62, -0.75], [-0.38, 0.55, -0.98]], 0.09)], labelAt: [2.1, 0.45, -0.7] },
        { id: 'coronarias', nombre: 'Arterias coronarias', alias: ['coronaria', 'coronarias', 'arteria coronaria', 'descendente anterior'], wiki: 'Arterias coronarias', color: '#f0743e', capa: 'coronarias', meshes: [tube([[0.05, 0.5, 0.62], [0.22, 0.0, 0.78], [0.42, -0.6, 0.66], [0.58, -1.18, 0.42]], 0.035), tube([[-0.15, 0.45, 0.6], [-0.55, 0.3, 0.55], [-0.85, 0.0, 0.3], [-0.6, -0.5, 0.1]], 0.032), tube([[0.2, 0.5, 0.45], [0.7, 0.4, 0.3], [0.95, 0.0, 0.0]], 0.03)], labelAt: [1.0, -1.9, 1.2] },
      ],
    }),
};
