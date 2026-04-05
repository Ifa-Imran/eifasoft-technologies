'use client';

import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NODE_COUNT = 40;
const CONNECTION_DISTANCE = 3.5;
const NODE_COLOR = new THREE.Color('#00F0FF');

function NeuralNetwork() {
  const groupRef = useRef<THREE.Group>(null);

  const { positions, connections } = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      pts.push([
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      ]);
    }

    const lines: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i][0] - pts[j][0];
        const dy = pts[i][1] - pts[j][1];
        const dz = pts[i][2] - pts[j][2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < CONNECTION_DISTANCE) {
          lines.push(
            pts[i][0], pts[i][1], pts[i][2],
            pts[j][0], pts[j][1], pts[j][2],
          );
        }
      }
    }

    const posArray = new Float32Array(pts.flat());
    const lineArray = new Float32Array(lines);

    return { positions: posArray, connections: lineArray };
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.03;
      groupRef.current.rotation.x += delta * 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Nodes */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={NODE_COLOR}
          size={0.08}
          transparent
          opacity={0.3}
          sizeAttenuation
        />
      </points>

      {/* Lines */}
      {connections.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[connections, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={NODE_COLOR}
            transparent
            opacity={0.1}
          />
        </lineSegments>
      )}
    </group>
  );
}

function NeuralBackgroundInner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    if (window.innerWidth > 1024) {
      setVisible(true);
    }

    const handleResize = () => setVisible(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none opacity-30"
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
      >
        <Suspense fallback={null}>
          <NeuralNetwork />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default NeuralBackgroundInner;
