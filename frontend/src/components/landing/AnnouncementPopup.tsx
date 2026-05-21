'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

// Bump this key whenever we publish a new one-time announcement so users see it once.
const ANNOUNCEMENT_KEY = 'kairo:announcement:mainnet-live-2026-05';

export function AnnouncementPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem(ANNOUNCEMENT_KEY);
      if (!seen) {
        // Small delay so the page paints first.
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable (private mode etc.) — show once per session.
      setOpen(true);
    }
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      try {
        window.localStorage.setItem(ANNOUNCEMENT_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="🚀 New Contracts Are Live!"
      size="md"
    >
      <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
        <p>
          Thank you, everyone, for your patience. We experienced a slight delay due
          to some technical dependencies, but we are thrilled to announce that the
          new contracts are now officially <span className="font-semibold text-primary-600">live and running smoothly</span>!
        </p>
        <p>
          We have provided a small initial liquidity, and the contracts are fully
          verified and published. True to the decentralized nature of our project,
          <span className="font-semibold text-primary-600"> 100% of the admin roles have been renounced</span>.
          The sky is the limit now! 🌌
        </p>
        <p>
          Go ahead, find your success on the best decentralized platform on Earth.
          We wish you all the very best of luck for a great future with{' '}
          <span className="font-orbitron font-bold gradient-text">KairoDAO</span>.
          Thank you!
        </p>

        <div className="pt-2 flex justify-end">
          <Button onClick={() => handleClose(false)} variant="primary">
            Let&apos;s Go 🚀
          </Button>
        </div>
      </div>
    </Modal>
  );
}
