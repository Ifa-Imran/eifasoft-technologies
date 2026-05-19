'use client';

import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

const STORAGE_KEY = 'kairodao_announcement_migration_v1_count';
const MAX_VIEWS = 3;

export function AnnouncementPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let count = 0;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      count = raw ? parseInt(raw, 10) : 0;
      if (Number.isNaN(count) || count < 0) count = 0;
    } catch {
      // localStorage may be unavailable (private mode); silently skip.
      return;
    }

    if (count >= MAX_VIEWS) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(count + 1));
    } catch {
      // Ignore write errors; still display this session.
    }
    setOpen(true);
  }, []);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      size="lg"
      title="Important Project Update & Transition Plan"
      className="p-4 sm:p-6 w-[94vw] sm:w-[90vw] max-w-[640px] rounded-2xl"
    >
      <div
        className="max-h-[70svh] sm:max-h-[70vh] overflow-y-auto overscroll-contain pr-1 sm:pr-2 space-y-4 sm:space-y-5 text-surface-700 text-[13px] sm:text-sm leading-relaxed break-words"
      >
        <p>Dear Community Members,</p>

        <p>
          Due to an unexpected technical error and the 100% decentralized nature of our
          original smart contracts, the previous project funds and liquidity are
          unfortunately locked and cannot be recovered. We deeply appreciate your patience
          as our team worked around the clock over the last 48 hours to build a seamless
          solution.
        </p>

        <div>
          <h3 className="text-surface-900 font-space-grotesk font-bold text-sm sm:text-base mb-2">
            Seamless Migration to New Contracts
          </h3>
          <p className="mb-3">
            To ensure no one loses their progress, we are deploying new smart contracts
            that mirror the exact same mechanics as before. The new contracts will go live
            within the next 24 hours.
          </p>
          <ul className="space-y-2 list-disc pl-4 sm:pl-5 marker:text-primary-500">
            <li>
              <span className="font-semibold text-surface-900">Automated Migration:</span>{' '}
              Your entire team structure, referrals, and account data remain intact. No
              re-registration is required.
            </li>
            <li>
              <span className="font-semibold text-surface-900">Asset Conversion:</span>{' '}
              Any CMS purchased, staked, or a combination of both will automatically be
              converted into an Active Stake of equivalent value in the new system. You
              will receive rewards based on this full amount with zero deductions.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-surface-900 font-space-grotesk font-bold text-sm sm:text-base mb-2">
            Rebuilding Liquidity Together
          </h3>
          <p>
            Our team is providing the initial liquidity to kickstart the new system.
            Because this is a 100% community-driven project, we kindly invite our members
            to stake a small additional amount (such as $100) if possible. Together, we
            can quickly surpass our previous liquidity levels and stabilize the project
            for the long term.
          </p>
        </div>

        <p className="text-surface-900 font-medium">
          Thank you for your unwavering energy and enthusiasm. Let&apos;s build a stronger,
          lifetime career together!
        </p>
      </div>

      <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button
          variant="primary"
          onClick={() => setOpen(false)}
          className="w-full sm:w-auto"
        >
          Got it
        </Button>
      </div>
    </Modal>
  );
}
