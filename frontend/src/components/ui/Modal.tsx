'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

// Responsive container:
// - On mobile (<640px): full-width (with 8px outer gutter), bottom-anchored
//   sheet-style so users on small phones can still tap the action buttons
//   without having to scroll past the keyboard.
// - On sm+ (>=640px): centered card with capped width.
// - Always: scrollable inner overflow so any modal body is reachable.
const RESPONSIVE_CLASSES =
  'fixed z-50 ' +
  // Mobile: bottom sheet, full width minus 8px gutter
  'left-2 right-2 bottom-2 ' +
  // sm+ : centered card
  'sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 ' +
  'sm:-translate-x-1/2 sm:-translate-y-1/2 ' +
  'sm:w-[92vw] ' +
  // Visual
  'card shadow-elevated ' +
  'p-4 sm:p-6 ' +
  // Internal scroll on tall content
  'max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overscroll-contain';

export function Modal({ open, onOpenChange, title, description, children, className, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  RESPONSIVE_CLASSES,
                  sizes[size],
                  className
                )}
              >
                <div className="flex items-center justify-between mb-4 gap-3">
                  {title && (
                    <Dialog.Title className="min-w-0 flex-1 truncate text-base sm:text-lg font-space-grotesk font-bold text-surface-900">
                      {title}
                    </Dialog.Title>
                  )}
                  <Dialog.Close className="flex-shrink-0 text-surface-400 hover:text-surface-700 transition-colors p-1 rounded-lg hover:bg-surface-100">
                    <XMarkIcon className="w-5 h-5" />
                  </Dialog.Close>
                </div>
                {description && (
                  <Dialog.Description className="text-surface-500 text-sm mb-4">
                    {description}
                  </Dialog.Description>
                )}
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
