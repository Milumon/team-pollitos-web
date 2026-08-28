'use client';

import { Crown, Sparkles } from 'lucide-react';
import { formatValue } from './RankingViews';
import type { RankingEntry, RankingMetric } from './types';

function tiktokAvatarUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  return `/api/tiktok/avatar?uri=${encodeURIComponent(uri)}`;
}

const RANK_CONFIG = {
  1: {
    height: 'h-28 sm:h-44',
    gradient: 'from-[#FFD700] via-[#FFB800] to-[#E69500]',
    border: 'border-yellow-400',
    ring: 'ring-2 sm:ring-4 ring-yellow-400 shadow-[0_0_18px_rgba(255,213,0,0.35)]',
    tag: '👑 MVP',
    tagColor: 'bg-yellow-400 text-black font-black',
    avatarSize: 'h-13 w-13 sm:h-20 sm:w-20',
    label: '#1',
  },
  2: {
    height: 'h-20 sm:h-32',
    gradient: 'from-[#E2E8F0] via-[#CBD5E1] to-[#94A3B8]',
    border: 'border-slate-300',
    ring: 'ring-2 sm:ring-4 ring-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.25)]',
    tag: '🥈 2do',
    tagColor: 'bg-slate-200 text-slate-800 font-bold',
    avatarSize: 'h-10 w-10 sm:h-16 sm:w-16',
    label: '#2',
  },
  3: {
    height: 'h-16 sm:h-26',
    gradient: 'from-[#FDBA74] via-[#FB923C] to-[#C2410C]',
    border: 'border-orange-300',
    ring: 'ring-2 sm:ring-4 ring-amber-500/70 shadow-[0_0_12px_rgba(251,146,60,0.25)]',
    tag: '🥉 3ro',
    tagColor: 'bg-amber-100 text-amber-900 font-bold',
    avatarSize: 'h-10 w-10 sm:h-16 sm:w-16',
    label: '#3',
  },
} as const;

function Pedestal({
  entry,
  rank,
  metric,
}: {
  entry: RankingEntry;
  rank: 1 | 2 | 3;
  metric: RankingMetric;
}) {
  const config = RANK_CONFIG[rank];
  const robloxUrl = entry.profile?.roblox_avatar_url;
  const tiktokUrl = tiktokAvatarUrl(entry.tiktok_avatar_uri);
  const imgSrc = robloxUrl || tiktokUrl;
  const linked = Boolean(entry.profile);
  const isChampion = rank === 1;

  return (
    <div
      className={`podium-col flex flex-1 flex-col items-center max-w-[32%] sm:max-w-[190px] min-w-0 transition-transform duration-300 ${
        isChampion ? 'z-20' : 'z-10'
      }`}
    >
      {/* Crown / Top Badge */}
      <div className="relative mb-1 sm:mb-2 flex flex-col items-center">
        {isChampion ? (
          <div className="animate-bounce mb-0.5 flex items-center justify-center">
            <span className="text-xl sm:text-3xl drop-shadow-[0_4px_8px_rgba(255,213,0,0.5)]">👑</span>
          </div>
        ) : (
          <div className="h-4 sm:h-6 flex items-center">
            <span className="text-sm sm:text-xl">{rank === 2 ? '🥈' : '🥉'}</span>
          </div>
        )}

        {/* Avatar with Halo */}
        <div className={`relative ${config.avatarSize} rounded-full ${config.ring} bg-neutral-900 overflow-hidden`}>
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              style={robloxUrl ? { transform: 'scale(1.4) translateY(-5%)' } : undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm sm:text-2xl font-bold bg-[#FFDFA0] text-neutral-800">
              🐣
            </div>
          )}

          {/* Sparkle on champion */}
          {isChampion && (
            <Sparkles className="absolute top-0.5 right-0.5 w-3 h-3 sm:w-4 sm:h-4 text-yellow-300 animate-pulse drop-shadow-xs" />
          )}
        </div>

        {/* Position Pill */}
        <span className={`absolute -bottom-2 px-1.5 sm:px-2.5 py-0.2 rounded-full text-[8px] sm:text-[10px] uppercase tracking-wider shadow-xs ${config.tagColor}`}>
          {config.tag}
        </span>
      </div>

      {/* Name + Roblox Tag */}
      <div className="mt-2.5 mb-1 text-center w-full px-0.5 overflow-hidden">
        <p className={`truncate font-black text-[#2D3139] leading-tight ${isChampion ? 'text-[11px] sm:text-base' : 'text-[10px] sm:text-sm'}`} title={entry.nickname || entry.display_id}>
          {entry.nickname || `@${entry.display_id}`}
        </p>
        
        {linked ? (
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            <span className="inline-flex items-center px-1 py-0.2 rounded-full bg-[#FFD500]/20 text-[#8B6B00] text-[7px] sm:text-[8px] font-black uppercase">
              Miembro
            </span>
            <span className="text-[8px] sm:text-[10px] text-gray-500 truncate max-w-[50px] sm:max-w-[90px]">
              @{entry.profile?.roblox_user}
            </span>
          </div>
        ) : (
          <p className="text-[8px] sm:text-[10px] text-gray-400 truncate">@{entry.display_id}</p>
        )}
      </div>

      {/* Value Pill (Score) */}
      <div className="mb-2 w-full px-0.5 flex justify-center">
        <span className={`inline-block truncate max-w-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-mono font-bold tracking-tight shadow-2xs ${
          isChampion
            ? 'bg-[#FFD500] text-black ring-1 sm:ring-2 ring-yellow-400/50'
            : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
        }`}>
          {formatValue(entry.value, metric)}
        </span>
      </div>

      {/* 3D Pedestal Bar */}
      <div
        className={`relative w-full ${config.height} rounded-t-xl sm:rounded-t-2xl bg-linear-to-b ${config.gradient} shadow-md border border-b-0 sm:border-2 ${config.border} flex flex-col items-center justify-between p-1.5 sm:p-3 overflow-hidden`}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-x-0 top-0 h-6 sm:h-10 bg-linear-to-b from-white/35 to-transparent pointer-events-none" />

        {/* Large watermark number */}
        <span className="text-xl sm:text-5xl font-black text-black/15 select-none font-display">
          {config.label}
        </span>

        {/* Subtitle */}
        <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-black/40 truncate w-full text-center">
          {rank === 1 ? 'CAMPEÓN' : rank === 2 ? '2DO' : '3RO'}
        </span>
      </div>
    </div>
  );
}

export function TopThreePodium({
  viewers,
  metric,
}: {
  viewers: RankingEntry[];
  metric: RankingMetric;
}) {
  const sorted = [...viewers].sort((a, b) => a.position - b.position);
  const first = sorted.find((e) => e.position === 1);
  const second = sorted.find((e) => e.position === 2);
  const third = sorted.find((e) => e.position === 3);

  if (!first && !second && !third) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-[#FFD500]/60 bg-linear-to-b from-[#FFFDF5] via-[#FFFBEB] to-[#FFF7DC] p-3 sm:p-8 shadow-[0_8px_30px_rgba(255,213,0,0.1)]">
      {/* Background Decorative Aura */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-yellow-300/20 rounded-full blur-3xl" />

      {/* Podium Grid */}
      <div className="relative z-10 flex items-end justify-center gap-1 sm:gap-6 pt-2 sm:pt-4">
        {second && <Pedestal entry={second} rank={2} metric={metric} />}
        {first && <Pedestal entry={first} rank={1} metric={metric} />}
        {third && <Pedestal entry={third} rank={3} metric={metric} />}
      </div>
    </div>
  );
}