'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetTimestamp: number; // Unix timestamp in seconds
  label?: string;
  compact?: boolean;
  onComplete?: () => void;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetTimestamp: number): TimeLeft {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, targetTimestamp - now);
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
  };
}

export function CountdownTimer({
  targetTimestamp,
  label,
  compact = false,
  onComplete,
  className = '',
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(targetTimestamp));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const tl = calculateTimeLeft(targetTimestamp);
      setTimeLeft(tl);
      if (tl.days === 0 && tl.hours === 0 && tl.minutes === 0 && tl.seconds === 0) {
        setExpired(true);
        onComplete?.();
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTimestamp, onComplete]);

  if (expired) {
    return (
      <div className={`text-red-400 font-semibold ${className}`}>
        {label ? `${label}: ` : ''}Expired
      </div>
    );
  }

  if (compact) {
    return (
      <span className={`font-mono text-dark-100 ${className}`}>
        {String(timeLeft.hours).padStart(2, '0')}:
        {String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
    );
  }

  const blocks = [
    { value: timeLeft.days, unit: 'Days' },
    { value: timeLeft.hours, unit: 'Hours' },
    { value: timeLeft.minutes, unit: 'Mins' },
    { value: timeLeft.seconds, unit: 'Secs' },
  ];

  return (
    <div className={className}>
      {label && <p className="text-sm text-dark-400 mb-2">{label}</p>}
      <div className="flex gap-3">
        {blocks.map((b) => (
          <div
            key={b.unit}
            className="flex flex-col items-center bg-dark-900/60 rounded-lg px-3 py-2 min-w-[56px]"
          >
            <span className="text-xl font-bold font-mono text-dark-50">
              {String(b.value).padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-dark-500 mt-0.5">
              {b.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
