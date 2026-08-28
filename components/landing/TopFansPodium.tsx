'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Crown, Flame, Sparkles, Trophy } from 'lucide-react';

type RankingEntry = {
  position: number;
  display_id: string;
  nickname: string;
  value: string;
  profile?: {
    roblox_user: string;
    roblox_display_name: string;
    roblox_avatar_url: string | null;
  } | null;
};

export function TopFansPodium() {
  const [topThree, setTopThree] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRankings() {
      try {
        const res = await fetch('/api/tiktok/rankings/current?limit=10', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          // Find viewers set
          const viewerSet = data.sets?.find(
            (s: any) => s.metric === 'viewers' && (s.period === '28_days' || s.period === 'last_live')
          ) || data.sets?.[0];

          if (viewerSet?.entries && mounted) {
            setTopThree(viewerSet.entries.slice(0, 3));
          }
        }
      } catch (err) {
        console.warn('Error loading top fans podium:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadRankings();
    return () => { mounted = false; };
  }, []);

  if (loading || topThree.length === 0) {
    return null;
  }

  // Rearrange order for classic podium visual: [2nd, 1st, 3rd]
  const first = topThree.find((e) => e.position === 1) || topThree[0];
  const second = topThree.find((e) => e.position === 2) || topThree[1];
  const third = topThree.find((e) => e.position === 3) || topThree[2];

  const podiumOrder = [
    { item: second, rank: 2, height: 'h-44', medal: '🥈', color: 'border-slate-300 bg-slate-100 text-slate-800' },
    { item: first, rank: 1, height: 'h-56', medal: '👑', color: 'border-yellow-400 bg-yellow-100 text-yellow-900 ring-4 ring-yellow-400/30' },
    { item: third, rank: 3, height: 'h-36', medal: '🥉', color: 'border-amber-600 bg-amber-100 text-amber-900' },
  ].filter((p) => Boolean(p.item));

  return (
    <section className="my-12 rounded-3xl border-2 border-[#FFD500] bg-linear-to-b from-[#FFFDF5] to-[#FFF7DC] p-6 sm:p-10 shadow-[8px_8px_0_#FFD500]">
      <div className="text-center max-w-xl mx-auto mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD500]/30 text-[#8B6B00] font-black text-xs uppercase tracking-widest mb-2">
          <Trophy className="w-3.5 h-3.5" /> Salón de la Fama
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-[#2D3139] tracking-tight uppercase">
          Podio de <span className="text-[#D4A000]">Pollitos Destacados</span>
        </h2>
        <p className="text-sm text-[#64748B] mt-2 font-medium">
          Los miembros más activos y fieles de nuestra comunidad durante las transmisiones en vivo.
        </p>
      </div>

      {/* Podium Grid */}
      <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-3xl mx-auto pt-6">
        {podiumOrder.map(({ item, rank, height, medal, color }) => {
          if (!item) return null;
          const avatarUrl = item.profile?.roblox_avatar_url;
          const displayName = item.profile?.roblox_display_name || item.nickname || item.display_id;
          const robloxTag = item.profile?.roblox_user ? `@${item.profile.roblox_user}` : `@${item.display_id}`;

          return (
            <div key={rank} className="flex-1 flex flex-col items-center max-w-[200px]">
              {/* Avatar & Medal */}
              <div className="relative mb-3 flex flex-col items-center">
                <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-3 overflow-hidden bg-white shadow-md ${color}`}>
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      fill
                      sizes="80px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-[#FFDFA0]">
                      🐣
                    </div>
                  )}
                </div>

                {/* Medal Badge */}
                <span className="absolute -bottom-2 -right-1 text-2xl drop-shadow-md">
                  {medal}
                </span>
              </div>

              {/* Name & Tag */}
              <div className="text-center mb-2 px-1 w-full">
                <p className="font-black text-sm sm:text-base text-[#2D3139] truncate" title={displayName}>
                  {displayName}
                </p>
                <p className="text-[0.75rem] font-semibold text-[#9A8D70] truncate">
                  {robloxTag}
                </p>
              </div>

              {/* Podium Step Block */}
              <div
                className={`w-full ${height} rounded-t-2xl border-2 border-b-0 flex flex-col items-center justify-center p-3 shadow-inner ${color}`}
              >
                <span className="font-black text-2xl sm:text-4xl opacity-80">#{rank}</span>
                <span className="text-[0.7rem] sm:text-xs font-bold uppercase tracking-wider mt-1 opacity-75">
                  {rank === 1 ? 'MVP' : rank === 2 ? 'Subcampeón' : 'Tercer Lugar'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}