'use client';

import { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon, UserIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { formatAddress } from '@/lib/utils';

export interface ReferralNode {
  address: string;
  volume: number;
  level: number;
  children: ReferralNode[];
}

interface ReferralTreeProps {
  data: ReferralNode[];
  className?: string;
}

const LEVEL_COLORS = [
  'border-primary-400/60 bg-primary-500/5',
  'border-primary-400/45 bg-primary-500/4',
  'border-primary-400/30 bg-primary-500/3',
  'border-primary-400/20 bg-primary-500/2',
  'border-primary-400/10 bg-primary-500/1',
];

const LEVEL_TEXT = [
  'text-primary-400',
  'text-primary-400/80',
  'text-primary-400/60',
  'text-primary-400/45',
  'text-primary-400/30',
];

function TreeNode({ node, depth = 0 }: { node: ReferralNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const levelIdx = Math.min(depth, 4);

  return (
    <div className="mt-1.5">
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left',
          LEVEL_COLORS[levelIdx],
          hasChildren && 'cursor-pointer hover:bg-dark-800/40',
          !hasChildren && 'cursor-default',
        )}
        style={{ marginLeft: depth * 20 }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDownIcon className="w-4 h-4 text-dark-400 shrink-0" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-dark-400 shrink-0" />
          )
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}

        <div className="p-1 rounded bg-dark-900/40">
          <UserIcon className={cn('w-3.5 h-3.5', LEVEL_TEXT[levelIdx])} />
        </div>

        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono text-dark-200 truncate">
              {formatAddress(node.address)}
            </span>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', LEVEL_COLORS[levelIdx], LEVEL_TEXT[levelIdx])}>
              L{node.level}
            </span>
          </div>
          <span className="text-xs font-mono text-dark-400 shrink-0">
            ${node.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>

        {hasChildren && (
          <span className="text-[10px] text-dark-500 shrink-0">
            ({node.children.length})
          </span>
        )}
      </button>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.address} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReferralTree({ data, className = '' }: ReferralTreeProps) {
  if (data.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <UserIcon className="w-12 h-12 text-dark-600 mx-auto mb-3" />
        <p className="text-dark-500">No referrals yet</p>
        <p className="text-xs text-dark-600 mt-1">Share your referral link to start building your team</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {data.map((node) => (
        <TreeNode key={node.address} node={node} />
      ))}
    </div>
  );
}
