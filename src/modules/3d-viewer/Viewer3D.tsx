import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ModelDef, PartDef, V3 } from '../../types/scene';
import { useViewer } from '../../stores/viewer';
import { ModelScene } from './ModelScene';
import { partCenter } from '../../engines/interaction-engine';

interface Props {
  model: ModelDef;
  escenaId: string;
  seleccionId?: string;
  onSelect(part: PartDef): void;
  onDeselect(): void;
}

const tmpTarget = new THREE.Vector3();
/** Tamaño real del lienzo (se actualiza desde CameraRig); camera.aspect puede ir un fotograma por detrás. */
const useThreeSize = { w: 0, h: 0 };

/** Posición de cámara que encaja el modelo completo, en la dirección indicada (o la inicial del modelo). */
function fitView(model: ModelDef, scene: THREE.Scene, camera: THREE.PerspectiveCamera, from?: V3): { position: V3; target: V3; dist: number } | null {
  const root = scene.getObjectByName('model-root');
  if (!root) return null;
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return null;
  // incluir las etiquetas (con un margen para su texto) para que ninguna quede fuera de la pantalla
  const portrait = useThreeSize.h > 0 && useThreeSize.w / useThreeSize.h < 0.8;
  // en vertical (teléfono) las etiquetas laterales cuentan menos para que el modelo no quede diminuto
  for (const p of model.parts) if (p.labelAt && p.selectable !== false) box.expandByPoint(new THREE.Vector3(p.labelAt[0] * (portrait ? 0.62 : 1.08), p.labelAt[1] + 0.15, p.labelAt[2] * (portrait ? 0.62 : 1)));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fovV = THREE.MathUtils.degToRad(camera.fov);
  const aspect = useThreeSize.h > 0 ? useThreeSize.w / useThreeSize.h : camera.aspect;
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
  const dist = (sphere.radius / Math.sin(Math.min(fovV, fovH) / 2)) * 0.86;
  const dir = new THREE.Vector3(...(from ?? model.camera.position)).sub(new THREE.Vector3(...model.camera.target)).normalize();
  const c = sphere.center;
  return { position: [c.x + dir.x * dist, c.y + dir.y * dist, c.z + dir.z * dist], target: [c.x, c.y, c.z], dist };
}

function CameraRig({ model, escenaId }: { model: ModelDef; escenaId: string }) {
  const { camera, controls, scene, size } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null; scene: THREE.Scene; size: { width: number; height: number } };
  useThreeSize.w = size.width;
  useThreeSize.h = size.height;
  const fitRaf = useRef(0);
  const anim = useRef<{ fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null>(null);
  const baseDist = useRef(10);
  const cameraRequest = useViewer((s) => s.cameraRequest);
  const zoomRequest = useViewer((s) => s.zoomRequest);

  const flyTo = (pos: V3, target: V3, instant = false) => {
    if (!controls) return;
    if (instant) {
      camera.position.set(...pos);
      controls.target.set(...target);
      controls.update();
      return;
    }
    anim.current = { fromP: camera.position.clone(), toP: new THREE.Vector3(...pos), fromT: controls.target.clone(), toT: new THREE.Vector3(...target), t: 0 };
  };

  // Al cambiar de escena: restaurar la cámara guardada o la inicial del modelo
  useEffect(() => {
    if (!controls) return;
    const saved = useViewer.getState().view(escenaId).camera;
    baseDist.current = new THREE.Vector3(...model.camera.position).distanceTo(new THREE.Vector3(...model.camera.target));
    if (saved) flyTo(saved.position, saved.target, true);
    else {
      flyTo(model.camera.position, model.camera.target, true);
      // Encajar el modelo completo en pantalla según el tamaño y la proporción del visor
      const raf = requestAnimationFrame(() => {
        const fit = fitView(model, scene, camera);
        if (fit) {
          baseDist.current = fit.dist;
          flyTo(fit.position, fit.target, true);
        }
      });
      fitRaf.current = raf;
    }
    const save = () => {
      useViewer.getState().patch(escenaId, { camera: { position: camera.position.toArray() as V3, target: controls.target.toArray() as V3 } });
    };
    const zoomPct = () => {
      const d = camera.position.distanceTo(controls.target);
      const pct = Math.round((baseDist.current / d) * 100);
      if (pct !== useViewer.getState().zoomPct) useViewer.getState().set({ zoomPct: pct });
    };
    controls.addEventListener('end', save);
    controls.addEventListener('change', zoomPct);
    zoomPct();
    return () => {
      cancelAnimationFrame(fitRaf.current);
      controls.removeEventListener('end', save);
      controls.removeEventListener('change', zoomPct);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escenaId, model, controls, size.width > size.height]);

  // Si cambia el tamaño del lienzo y el usuario no ha movido la cámara, volver a encajar el modelo
  useEffect(() => {
    if (!controls || useViewer.getState().view(escenaId).camera) return;
    const id = requestAnimationFrame(() => {
      const fit = fitView(model, scene, camera);
      if (fit) {
        baseDist.current = fit.dist;
        flyTo(fit.position, fit.target, true);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  useEffect(() => {
    if (!cameraRequest || cameraRequest.escenaId !== escenaId || !controls) return;
    if (cameraRequest.focusPartId) {
      const p = model.parts.find((x) => x.id === cameraRequest.focusPartId);
      if (!p) return;
      const c = partCenter(p);
      const dir = camera.position.clone().sub(controls.target).normalize();
      const dist = Math.max(5, camera.position.distanceTo(controls.target) * 0.85);
      flyTo([c[0] + dir.x * dist, c[1] + dir.y * dist, c[2] + dir.z * dist], c);
    } else {
      if (!cameraRequest.position) {
        const fit = fitView(model, scene, camera);
        if (fit) flyTo(fit.position, fit.target);
        else flyTo(model.camera.position, model.camera.target);
      } else {
        // vista predefinida: misma dirección, distancia que encaja el modelo
        const fit = fitView(model, scene, camera, cameraRequest.position);
        flyTo(fit?.position ?? cameraRequest.position, fit?.target ?? cameraRequest.target ?? model.camera.target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest?.nonce]);

  useEffect(() => {
    if (!zoomRequest || !controls) return;
    tmpTarget.copy(controls.target);
    const off = camera.position.clone().sub(tmpTarget).multiplyScalar(zoomRequest.factor);
    const d = off.length();
    if (d < 1.2 || d > 60) return;
    anim.current = { fromP: camera.position.clone(), toP: tmpTarget.clone().add(off), fromT: controls.target.clone(), toT: controls.target.clone(), t: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRequest?.nonce]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt * 1.8);
    const e = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.fromP, a.toP, e);
    controls.target.lerpVectors(a.fromT, a.toT, e);
    controls.update();
    if (a.t >= 1) {
      anim.current = null;
      useViewer.getState().patch(escenaId, { camera: { position: camera.position.toArray() as V3, target: controls.target.toArray() as V3 } });
    }
  });
  return null;
}

export function Viewer3D({ model, escenaId, seleccionId, onSelect, onDeselect }: Props) {
  const view = useViewer((s) => s.views[escenaId]) ?? useViewer.getState().view(escenaId);
  const etiquetas = useViewer((s) => s.etiquetas);
  const animar = useViewer((s) => s.animar);
  const autoRotar = useViewer((s) => s.autoRotar);
  const minY = Math.min(...model.parts.flatMap((p) => p.meshes.map((m) => (m.position?.[1] ?? 0)))) - 1.4;

  return (
    <Canvas
      shadows
      dpr={[1, typeof window !== 'undefined' && window.innerWidth < 768 ? 1.5 : 2]}
      camera={{ position: model.camera.position, fov: 42, near: 0.05, far: 300 }}
      gl={{ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
      onPointerMissed={(e) => {
        if (e.type === 'click') onDeselect();
      }}
      aria-label={`Visualización 3D: ${model.titulo}`}
    >
      <color attach="background" args={['#070b10']} />
      <fog attach="fog" args={['#070b10', 18, 60]} />
      <hemisphereLight args={['#cfe8ff', '#1a1f2b', 0.7]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 9, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 3, -5]} intensity={0.55} color="#7dd3fc" />
      <pointLight position={[0, -4, 4]} intensity={8} distance={14} color="#a78bfa" />
      {/* Reflejos de estudio generados localmente (sin descargar mapas HDR) */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 5, -6]} scale={[10, 4, 1]} color="#ffffff" />
        <Lightformer intensity={1.2} position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#a5f3fc" />
        <Lightformer intensity={1} position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} color="#ddd6fe" />
        <Lightformer intensity={0.6} position={[0, -4, 3]} rotation-x={-Math.PI / 2} scale={[8, 8, 1]} color="#fde2e4" />
      </Environment>
      <Suspense fallback={null}>
        <ModelScene model={model} view={view} seleccionId={seleccionId} etiquetas={etiquetas} animar={animar} onSelect={onSelect} />
      </Suspense>
      <ContactShadows position={[0, minY, 0]} opacity={0.45} scale={18} blur={2.6} far={6} color="#000" />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1.2} maxDistance={60} autoRotate={autoRotar} autoRotateSpeed={0.8} />
      <CameraRig model={model} escenaId={escenaId} />
    </Canvas>
  );
}
