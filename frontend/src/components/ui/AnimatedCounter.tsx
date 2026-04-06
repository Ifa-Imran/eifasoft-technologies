'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCompact } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  compact?: boolean;
}

export function AnimatedCounter({
  value,
  duration = 1500,
  decimals = 2,
  prefix = '',
  suffix = '',
  className,
  compact = false,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = startRef.current + (value - startRef.current) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const formatted = (compact || Math.abs(displayValue) >= 1e6)
    ? formatCompact(displayValue, decimals)
    : displayValue.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
