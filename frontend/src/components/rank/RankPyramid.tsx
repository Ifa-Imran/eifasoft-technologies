'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RANKS, type RankInfo } from '@/hooks/useRankData';
import { Tooltip } from '@/components/ui/Tooltip';

interface RankPyramidProps {
  currentRankLevel: number; // -1 = no rank
  className?: string;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function PyramidRow({
  rank,
  index,
  currentRankLevel,
  totalLevels,
}: {
  rank: RankInfo;
  index: number;
  currentRankLevel: number;
  totalLevels: number;
}) {
  const isCurrent = index === currentRankLevel;
  const isAchieved = index < currentRankLevel;
  const isNext = index === currentRankLevel + 1;
  // Pyramid displayed top (Universe=9) to bottom (Starlight=0)
  const displayIndex = totalLevels - 1 - index;
  // Width: top row (Universe) is narrowest, bottom row (Starlight) is widest
  const widthPercent = 30 + (displayIndex / (totalLevels - 1)) * 70;

  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <p className="font-semibold text-white">{rank.name} (Level {rank.level})</p>
          <p>Volume: {formatCompact(rank.thresholdUSD)}</p>
          <p>Weekly Salary: {formatCompact(rank.salaryUSD)}</p>
        </div>
      }
      side="right"
    >
      <motion.div
        initial={{ opacity: 0, scaleX: 0.5 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.4, delay: displayIndex * 0.05 }}
        className={cn(
          'relative flex items-center justify-between px-3 md:px-5 py-2 md:py-2.5 mx-auto rounded-lg border transition-all',
          'backdrop-blur-sm cursor-default',
          isCurrent && 'bg-neon-cyan/10 border-neon-cyan/60 shadow-[0_0_20px_rgba(0,240,255,0.2)]',
          isAchieved && 'bg-matrix-green/8 border-matrix-green/30',
          isNext && 'bg-neon-purple/8 border-neon-purple/30 shadow-[0_0_12px_rgba(112,0,255,0.1)]',
          !isCurrent && !isAchieved && !isNext && 'bg-white/[0.02] border-white/[0.06]',
        )}
        style={{ width: `${widthPercent}%` }}
      >
        {/* Rank Level Badge */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span
            className={cn(
              'text-[10px] md:text-xs font-bold w-5 md:w-6 h-5 md:h-6 rounded-full flex items-center justify-center shrink-0',
              isCurrent && 'bg-neon-cyan/20 text-neon-cyan',
              isAchieved && 'bg-matrix-green/20 text-matrix-green',
              isNext && 'bg-neon-purple/20 text-neon-purple',
              !isCurrent && !isAchieved && !isNext && 'bg-white/5 text-gray-600',
            )}
          >
            {rank.level}
          </span>
          <span
            className={cn(
              'text-xs md:text-sm font-semibold truncate',
              isCurrent && 'text-neon-cyan font-orbitron',
              isAchieved && 'text-matrix-green',
              isNext && 'text-neon-purple',
              !isCurrent && !isAchieved && !isNext && 'text-gray-500',
            )}
          >
            {rank.name}
          </span>
        </div>

        {/* Middle: volume & directs (hidden on small mobile) */}
        <div className="hidden sm:flex items-center gap-4 text-[10px] md:text-xs font-mono">
          <span className={cn(
            isCurrent ? 'text-neon-cyan/80' : isAchieved ? 'text-matrix-green/70' : isNext ? 'text-neon-purple/70' : 'text-gray-600',
          )}>
            {formatCompact(rank.thresholdUSD)}
          </span>
        </div>

        {/* Right: salary */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'text-[10px] md:text-xs font-mono',
              isCurrent ? 'text-neon-cyan/80' : isAchieved ? 'text-matrix-green/70' : isNext ? 'text-neon-purple/70' : 'text-gray-600',
            )}
          >
            {formatCompact(rank.salaryUSD)}/w
          </span>

          {isCurrent && (
            <span className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded bg-neon-cyan/20 text-neon-cyan whitespace-nowrap animate-glow-pulse">
              YOU
            </span>
          )}
          {isNext && (
            <span className="text-[9px] md:text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neon-purple/15 text-neon-purple/70 whitespace-nowrap">
              NEXT
            </span>
          )}
        </div>
      </motion.div>
    </Tooltip>
  );
}

export function RankPyramid({ currentRankLevel, className }: RankPyramidProps) {
  // Display from top (Universe = level 9) to bottom (Starlight = level 0)
  const ranksTopToBottom = [...RANKS].reverse();

  return (
    <div className={cn('flex flex-col gap-1 md:gap-1.5', className)}>
      {ranksTopToBottom.map((rank) => (
        <PyramidRow
          key={rank.level}
          rank={rank}
          index={rank.level}
          currentRankLevel={currentRankLevel}
          totalLevels={RANKS.length}
        />
      ))}
    </div>
  );
}
