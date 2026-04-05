'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  className?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({ tabs, defaultValue, className, onValueChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value || '');

  const handleChange = (value: string) => {
    setActiveTab(value);
    onValueChange?.(value);
  };

  return (
    <TabsPrimitive.Root
      value={activeTab}
      onValueChange={handleChange}
      className={cn('w-full', className)}
    >
      <TabsPrimitive.List className="flex gap-1 p-1 rounded-xl bg-glass backdrop-blur-sm border border-glass-border mb-4">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'relative flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200',
              'text-gray-400 hover:text-gray-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50',
              'data-[state=active]:text-neon-cyan',
            )}
          >
            {activeTab === tab.value && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-lg bg-neon-cyan/10 border-b-2 border-neon-cyan"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <AnimatePresence mode="wait">
        {tabs.map((tab) => (
          <TabsPrimitive.Content
            key={tab.value}
            value={tab.value}
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab.content}
            </motion.div>
          </TabsPrimitive.Content>
        ))}
      </AnimatePresence>
    </TabsPrimitive.Root>
  );
}
