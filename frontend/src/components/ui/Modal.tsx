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
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

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
                initial={{ opacity: 0, scale: 0.95, x: '-50%', y: 'calc(-50% + 20px)' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.95, x: '-50%', y: 'calc(-50% + 20px)' }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'fixed top-1/2 left-1/2 z-50',
                  'card p-6 shadow-elevated w-[90vw]',
                  sizes[size],
                  className
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  {title && (
                    <Dialog.Title className="text-base sm:text-lg font-space-grotesk font-bold text-surface-900 leading-snug min-w-0 break-words">
                      {title}
                    </Dialog.Title>
                  )}
                  <Dialog.Close className="shrink-0 text-surface-400 hover:text-surface-700 transition-colors p-1 rounded-lg hover:bg-surface-100">
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
