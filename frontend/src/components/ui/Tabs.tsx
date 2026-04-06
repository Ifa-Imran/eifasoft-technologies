'use client';

import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface Tab {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ tabs, value, onValueChange, children, className }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List className="flex gap-1 p-1 bg-surface-100 rounded-xl mb-4">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              'text-surface-500 hover:text-surface-700',
              'data-[state=active]:bg-white data-[state=active]:text-primary-600 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-surface-200'
            )}
          >
            {tab.icon}
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabContent = RadixTabs.Content;
