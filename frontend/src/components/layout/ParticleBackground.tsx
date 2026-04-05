'use client';

import { useMemo } from 'react';

interface Particle {
  id: number;
  size: number;
  x: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
  color: string;
}

export function ParticleBackground() {
  const particles = useMemo<Particle[]>(() => {
    const colors = ['#00F0FF', '#7000FF'];
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      size: 2 + Math.random() * 2,
      x: Math.random() * 100,
      opacity: 0.1 + Math.random() * 0.2,
      duration: 20 + Math.random() * 40,
      delay: Math.random() * -60,
      drift: -30 + Math.random() * 60,
      color: colors[i % 2],
    }));
  }, []);

  return (
    <div
      className="particle-bg-container"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle-dot"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            opacity: p.opacity,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
