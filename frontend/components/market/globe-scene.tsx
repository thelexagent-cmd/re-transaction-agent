'use client';

import { useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import type { WatchlistEntry } from '@/lib/api';

const TEXTURE_BASE = 'https://threejs.org/examples/textures/planets';

// ── Atmosphere shader ───────────────────────────────────────────────────────

const atmVert = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmFrag = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0,0,1.0)), 3.5);
    gl_FragColor = vec4(glowColor, intensity * 0.9);
  }
`;
const hazeVert = atmVert;
const hazeFrag = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.6 - dot(vNormal, vec3(0,0,1.0)), 4.0);
    gl_FragColor = vec4(glowColor, intensity * 0.4);
  }
`;

// ── Stars ───────────────────────────────────────────────────────────────────

function Stars() {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const r = 80 + Math.random() * 20;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={0xffffff} size={0.08} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}

// ── ZIP marker ──────────────────────────────────────────────────────────────

function ZipMarker({ lat, lon, score }: { lat: number; lon: number; score: number }) {
  const ringRef  = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const R = 1.016;
  const x = -(R * Math.sin(phi) * Math.cos(theta));
  const y =   R * Math.cos(phi);
  const z =   R * Math.sin(phi) * Math.sin(theta);
  const pos = new THREE.Vector3(x, y, z);

  const color = score >= 70 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#64748b';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + 0.35 * Math.sin(t * 2.5);
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - (s - 1) / 0.35) + 0.1;
    }
    if (ring2Ref.current) {
      const s = 1 + 0.6 * Math.abs(Math.sin(t * 1.8));
      ring2Ref.current.scale.setScalar(s);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.2 * (1.6 - s);
    }
  });

  const lookTarget = pos.clone().multiplyScalar(2);

  return (
    <group>
      <mesh position={pos}>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ringRef} position={pos} onUpdate={(m) => m.lookAt(lookTarget)}>
        <ringGeometry args={[0.018, 0.022, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} position={pos} onUpdate={(m) => m.lookAt(lookTarget)}>
        <ringGeometry args={[0.026, 0.028, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Earth ───────────────────────────────────────────────────────────────────

function Earth({ watchlist }: { watchlist: WatchlistEntry[] }) {
  const cloudRef = useRef<THREE.Mesh>(null);

  const [dayMap, specMap, normMap, cloudMap] = useLoader(TextureLoader, [
    `${TEXTURE_BASE}/earth_atmos_2048.jpg`,
    `${TEXTURE_BASE}/earth_specular_2048.jpg`,
    `${TEXTURE_BASE}/earth_normal_2048.jpg`,
    `${TEXTURE_BASE}/earth_clouds_1024.png`,
  ]);

  useFrame(({ clock }) => {
    if (cloudRef.current) cloudRef.current.rotation.y = clock.getElapsedTime() * 0.003;
  });

  return (
    <group rotation={[0, 0, 0.41]}>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={dayMap}
          specularMap={specMap}
          normalMap={normMap}
          specular={new THREE.Color(0x223366)}
          shininess={25}
          normalScale={new THREE.Vector2(0.85, 0.85)}
        />
      </mesh>
      <mesh ref={cloudRef}>
        <sphereGeometry args={[1.003, 64, 64]} />
        <meshPhongMaterial map={cloudMap} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {watchlist.map((entry) => {
        const prop = (entry as any).latest_property;
        if (!prop?.latitude || !prop?.longitude) return null;
        return (
          <ZipMarker
            key={entry.zip_code}
            lat={prop.latitude}
            lon={prop.longitude}
            score={prop.opportunity_score ?? 0}
          />
        );
      })}
    </group>
  );
}

// ── Full scene ───────────────────────────────────────────────────────────────

function Scene({ watchlist }: { watchlist: WatchlistEntry[] }) {
  return (
    <>
      <ambientLight color={0x1a2744} intensity={2.5} />
      <directionalLight color={0xffffff} intensity={3.5} position={[3, 1, 2]} />
      <directionalLight color={0x1d4ed8} intensity={1.2} position={[-3, -1, -2]} />
      <Stars />
      <Suspense fallback={null}>
        <Earth watchlist={watchlist} />
      </Suspense>
      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[1.08, 64, 64]} />
        <shaderMaterial
          vertexShader={atmVert}
          fragmentShader={atmFrag}
          uniforms={{ glowColor: { value: new THREE.Color(0x1a6bff) } }}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
      {/* Outer haze */}
      <mesh>
        <sphereGeometry args={[1.18, 64, 64]} />
        <shaderMaterial
          vertexShader={hazeVert}
          fragmentShader={hazeFrag}
          uniforms={{ glowColor: { value: new THREE.Color(0x0a3080) } }}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.4}
        autoRotate
        autoRotateSpeed={0.35}
        minDistance={1.6}
        maxDistance={4.5}
      />
    </>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export function GlobeScene({ watchlist }: { watchlist: WatchlistEntry[] }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 45 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      style={{ width: '100%', height: '100%', background: '#050a12' }}
    >
      <Scene watchlist={watchlist} />
    </Canvas>
  );
}
