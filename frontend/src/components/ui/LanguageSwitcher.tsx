'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { localeList, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  /** Compact mode shows only the flag on small screens. */
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({ compact = false, className }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('language');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  const switchLocale = useCallback(
    (locale: Locale) => {
      setOpen(false);
      if (locale === currentLocale) return;
      // next-intl router.replace with { locale } swaps the prefix and
      // the middleware persists the choice in the NEXT_LOCALE cookie.
      router.replace(pathname, { locale });
    },
    [currentLocale, pathname, router],
  );

  const current = localeList.find((l) => l.code === currentLocale) ?? localeList[0];

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('switchLabel')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-medium text-surface-600 hover:text-primary-700 hover:bg-primary-50/60 border border-surface-200 hover:border-primary-300 transition-all duration-200"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className={cn('hidden sm:inline', compact && 'hidden')}>{current.nativeName}</span>
        <svg
          className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={t('switchLabel')}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 rtl:left-0 rtl:right-auto mt-2 w-52 max-h-80 overflow-y-auto rounded-2xl border border-surface-200 bg-white shadow-elevated z-50 py-1.5"
          >
            {localeList.map((l) => {
              const active = l.code === currentLocale;
              return (
                <li key={l.code} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => switchLocale(l.code)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-sm text-left rtl:text-right transition-colors',
                      active
                        ? 'text-primary-700 bg-primary-50/70 font-semibold'
                        : 'text-surface-600 hover:bg-surface-50',
                    )}
                  >
                    <span className="text-base leading-none flex-shrink-0">{l.flag}</span>
                    <span className="flex-1">{l.nativeName}</span>
                    {active && (
                      <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
