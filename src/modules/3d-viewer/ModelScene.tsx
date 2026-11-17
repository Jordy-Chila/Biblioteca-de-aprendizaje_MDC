import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, Outlines } from '@react-three/drei';
import type { MeshSpec, ModelDef, PartDef, V3 } from '../../types/scene';
import { createMeshGeometry } from './geometry';
import { explodeOffset, modelCenter, partCenter, visualState } from '../../engines/interaction-engine';
import type { SceneView } from '../../stores/viewer';

interface Props {
  model: ModelDef;
  view: SceneView;
  seleccionId?: string;
  etiquetas: boolean;
  animar: boolean;
  onSelect(part: PartDef): void;
}

const MATERIAL: Record<NonNullable<PartDef['material']> | 'default', { roughness: number; metalness: number; clearcoat: number; clearcoatRoughness: number; sheen: number }> = {
  default: { roughness: 0.5, metalness: 0.05, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0 },
  tejido: { roughness: 0.45, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.6 },
  piel: { roughness: 0.6, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 1 },
  membrana: { roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.3 },
  liquido: { roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0 },
  hueso: { roughness: 0.75, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.8, sheen: 0.2 },
  metal: { roughness: 0.3, metalness: 0.75, clearcoat: 0.3, clearcoatRoughness: 0.3, sheen: 0 },
  plastico: { roughness: 0.35, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0 },
  brillo: { roughness: 0.4, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, sheen: 0 },
};

function isOpenSurface(spec: MeshSpec): boolean {
  const g = spec.geom;
  return (g.kind === 'sphere' && (g.phiLength !== undefined || g.thetaLength !== undefined)) || g.kind === 'lathe' || g.kind === 'shell' || g.kind === 'ring' || g.kind === 'surface' || (g.kind === 'cylinder' && Boolean(g.open));
}

function PartMesh({ spec, color, emissive, material, state, selected, pickable }: { spec: MeshSpec; color: string; emissive?: string; material?: PartDef['material']; state: ReturnType<typeof visualState>; selected: boolean; pickable: boolean }) {
  const geom = useMemo(() => createMeshGeometry(spec), [spec]);
  useEffect(() => () => geom.dispose(), [geom]);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const preset = MATERIAL[material ?? 'default'];
  const tint = spec.color ?? color;
  const sheenColor = useMemo(() => new THREE.Color(tint).lerp(new THREE.Color('#ffffff'), 0.45), [tint]);
  const doubleSide = isOpenSurface(spec);
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const k = Math.min(1, dt * 8);
    m.opacity += (state.opacity - m.opacity) * k;
    m.emissiveIntensity += ((emissive ? 0.35 : 0) + state.emissive - m.emissiveIntensity) * k;
    m.transparent = m.opacity < 0.995;
    m.depthWrite = m.opacity > 0.6;
  });
  return (
    <mesh geometry={geom} {...(pickable ? {} : { raycast: () => null })} position={spec.position} rotation={spec.rotation} scale={spec.scale} castShadow receiveShadow renderOrder={state.opacity < 1 ? 2 : 1}>
      <meshPhysicalMaterial
        ref={mat}
        color={tint}
        emissive={selected ? '#22d3ee' : (emissive ?? tint)}
        emissiveIntensity={0}
        roughness={preset.roughness}
        metalness={preset.metalness}
        clearcoat={preset.clearcoat}
        clearcoatRoughness={preset.clearcoatRoughness}
        sheen={preset.sheen}
        sheenColor={sheenColor}
        sheenRoughness={0.5}
        transparent
        opacity={state.opacity}
        side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
      />
      {selected && !doubleSide && <Outlines thickness={2.2} color="#22d3ee" screenspace opacity={0.95} transparent />}
    </mesh>
  );
}

function animOffset(part: PartDef, t: number): { pos: V3; rot: V3; scale: number } {
  const a = part.anim;
  if (!a) return { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 };
  switch (a.type) {
    case 'spin':
      return { pos: [0, 0, 0], rot: [a.axis[0] * t * a.speed, a.axis[1] * t * a.speed, a.axis[2] * t * a.speed], scale: 1 };
    case 'pulse':
      return { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 + Math.max(0, Math.sin(t * a.speed + (a.phase ?? 0))) * a.amp };
    case 'orbit': {
      const th = t * a.speed + (a.phase ?? 0);
      const tilt = a.tilt ?? 0;
      return { pos: [Math.cos(th) * a.radius, Math.sin(th) * a.radius * Math.sin(tilt), Math.sin(th) * a.radius * Math.cos(tilt)], rot: [0, 0, 0], scale: 1 };
    }
    case 'flow': {
      const pts = a.path;
      const segs = pts.length - 1;
      const u = (((t * a.speed + (a.phase ?? 0)) % 1) + 1) % 1;
      const f = u * segs;
      const i = Math.min(segs - 1, Math.floor(f));
      const w = f - i;
      const p: V3 = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * w, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * w, pts[i][2] + (pts[i + 1][2] - pts[i][2]) * w];
      return { pos: p, rot: [0, 0, 0], scale: 1 };
    }
  }
}

function Part({ part, dense, defaultMaterial, center, view, seleccionId, hoverId, setHover, etiquetas, animar, onSelect, capaOculta }: {
  part: PartDef; dense: boolean; defaultMaterial?: PartDef['material']; center: V3; view: SceneView; seleccionId?: string; hoverId?: string; setHover(id?: string): void; etiquetas: boolean; animar: boolean; onSelect(p: PartDef): void; capaOculta: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const [anchor, setAnchor] = useState<V3>();
  // Punto de anclaje de la etiqueta: donde un rayo desde la etiqueta hacia la pieza toca su superficie
  useEffect(() => {
    if (!part.labelAt) return;
    if (part.anchorAt) {
      setAnchor(part.anchorAt);
      return;
    }
    const id = requestAnimationFrame(() => {
      const g = group.current, ms = meshes.current;
      if (!g || !ms) return;
      g.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(ms);
      if (box.isEmpty()) return;
      const from = g.localToWorld(new THREE.Vector3(...part.labelAt!));
      const to = box.getCenter(new THREE.Vector3());
      const ray = new THREE.Raycaster(from, to.clone().sub(from).normalize());
      const hit = ray.intersectObjects(ms.children, true)[0];
      const p = g.worldToLocal((hit?.point ?? to).clone());
      setAnchor([p.x, p.y, p.z]);
    });
    return () => cancelAnimationFrame(id);
  }, [part]);
  const selectable = part.selectable !== false;
  const state = visualState(part.id, { seleccionId, hoverId, ocultos: capaOculta ? [...view.ocultos, part.id] : view.ocultos, transparentes: view.transparentes, aislado: view.aislado, baseOpacity: part.opacity ?? 1 });
  const target = explodeOffset(part, center, view.explode);
  const selected = seleccionId === part.id;
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (animar) clock.current += dt;
    const k = Math.min(1, dt * 6);
    const an = animOffset(part, clock.current);
    g.position.x += (target[0] + an.pos[0] - g.position.x) * (part.anim?.type === 'orbit' || part.anim?.type === 'flow' ? 1 : k);
    g.position.y += (target[1] + an.pos[1] - g.position.y) * (part.anim?.type === 'orbit' || part.anim?.type === 'flow' ? 1 : k);
    g.position.z += (target[2] + an.pos[2] - g.position.z) * (part.anim?.type === 'orbit' || part.anim?.type === 'flow' ? 1 : k);
    g.rotation.set(an.rot[0], an.rot[1], an.rot[2]);
    const s = (state.scale * an.scale - g.scale.x) * k + g.scale.x;
    g.scale.setScalar(s);
  });
  if (!state.visible) return null;
  const label = part.labelAt ?? partCenter(part);
  const handlers = selectable
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(part);
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(part.id);
          document.body.style.cursor = 'pointer';
        },
        onPointerOut: () => {
          setHover(undefined);
          document.body.style.cursor = '';
        },
      }
    : {};
  const revealed = !part.labelOnFocus || view.capasOcultas.length > 0 || view.explode > 0.3;
  const showLabel = selectable && part.labelAt !== undefined && etiquetas && (selected || hoverId === part.id || (!seleccionId && revealed));
  const lead = anchor && showLabel && Math.hypot(label[0] - anchor[0], label[1] - anchor[1], label[2] - anchor[2]) > 0.35;
  return (
    <group ref={group} userData={{ partId: part.id }} {...handlers}>
      <group ref={meshes}>
        {part.meshes.map((m, i) => (
          <PartMesh key={i} spec={m} color={part.color} emissive={part.emissive} material={part.material ?? defaultMaterial} state={state} selected={selected} pickable={selectable} />
        ))}
      </group>
      {lead && (
        <>
          <Line points={[label, anchor!]} color={selected ? '#22d3ee' : '#cbd5e1'} lineWidth={selected ? 1.6 : 1} transparent opacity={state.dim ? 0.2 : selected ? 0.95 : 0.55} raycast={() => null} />
          <mesh position={anchor!} raycast={() => null} renderOrder={5}>
            <sphereGeometry args={[selected ? 0.05 : 0.035, 12, 12]} />
            <meshBasicMaterial color={selected ? '#22d3ee' : '#f8fafc'} transparent opacity={state.dim ? 0.3 : 1} depthTest={false} />
          </mesh>
        </>
      )}
      {showLabel && (
        <Html position={label} center distanceFactor={dense ? 7 : 8} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(part);
            }}
            onPointerEnter={() => setHover(part.id)}
            onPointerLeave={() => setHover(undefined)}
            title={`Ver información de ${part.nombre}`}
            className={`label3d ${dense && !selected && hoverId !== part.id ? 'label3d--sm' : ''} ${selected ? 'label3d--on' : ''} ${state.dim ? 'label3d--dim' : ''}`}
          >
            {part.nombre.length > 34 && !selected ? part.nombre.slice(0, 32) + '…' : part.nombre}
          </button>
        </Html>
      )}
    </group>
  );
}

export function ModelScene({ model, view, seleccionId, etiquetas, animar, onSelect }: Props) {
  const center = useMemo(() => modelCenter(model), [model]);
  const [hoverId, setHover] = useState<string>();
  const capaDe = useMemo(() => new Map(model.parts.map((p) => [p.id, p.capa])), [model]);
  const centers = useMemo(() => new Map(model.parts.map((p) => [p.id, partCenter(p)])), [model]);
  const dense = useMemo(() => model.parts.filter((p) => p.selectable !== false && p.labelAt).length > 14, [model]);
  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);
  return (
    <group name="model-root">
      {model.parts.map((p) => (
        <Part key={p.id} part={p} dense={dense} defaultMaterial={model.id.startsWith('anatomia') ? 'tejido' : model.id.startsWith('biologia') ? 'membrana' : undefined} center={center} view={view} seleccionId={seleccionId} hoverId={hoverId} setHover={setHover} etiquetas={etiquetas} animar={animar} onSelect={onSelect} capaOculta={Boolean(p.capa && view.capasOcultas.includes(p.capa))} />
      ))}
      {model.links?.map((l, i) => {
        const a = centers.get(l.from), b = centers.get(l.to);
        if (!a || !b) return null;
        const hidden = [l.from, l.to].some((id) => view.ocultos.includes(id) || (capaDe.get(id) && view.capasOcultas.includes(capaDe.get(id)!)));
        if (hidden) return null;
        const active = seleccionId && (l.from === seleccionId || l.to === seleccionId);
        const pa = model.parts.find((p) => p.id === l.from), pb = model.parts.find((p) => p.id === l.to);
        const oa = pa ? explodeOffset(pa, center, view.explode) : [0, 0, 0];
        const ob = pb ? explodeOffset(pb, center, view.explode) : [0, 0, 0];
        return (
          <Line
            key={i}
            points={[
              [a[0] + oa[0], a[1] + oa[1], a[2] + oa[2]],
              [b[0] + ob[0], b[1] + ob[1], b[2] + ob[2]],
            ]}
            color={active ? '#22d3ee' : '#64748b'}
            lineWidth={active ? 2.2 : 1}
            transparent
            opacity={seleccionId && !active ? 0.15 : 0.6}
          />
        );
      })}
    </group>
  );
}
