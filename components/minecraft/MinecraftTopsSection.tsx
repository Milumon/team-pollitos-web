'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { 
  Pickaxe, 
  Sword, 
  Clock, 
  Hammer, 
  Flame, 
  Sparkles, 
  Gem, 
  Skull, 
  Compass, 
  BedDouble,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Crown,
  Trophy,
  Target,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export type MinecraftMetric = 
  | 'playtime' 
  | 'mining' 
  | 'diamonds'
  | 'kills' 
  | 'building' 
  | 'deaths' 
  | 'distance' 
  | 'sleeps';

interface LeaderboardEntry {
  id: string;
  user_id?: string | null;
  username: string;
  edition: 'java' | 'bedrock';
  roblox_user?: string | null;
  roblox_display_name?: string | null;
  minecraft_avatar_url: string;
  minecraft_rank: string;
  is_admin: boolean;
  position: number;
  stats: {
    playtime_hours: number;
    blocks_mined: number;
    diamonds_mined: number;
    mobs_killed: number;
    blocks_placed: number;
    deaths: number;
    distance_km: number;
    jumps: number;
    sleeps: number;
  };
}

const METRIC_CONFIG = {
  playtime: {
    label: 'Tiempo Jugado',
    icon: Clock,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} hrs`,
    description: 'Horas acumuladas sobreviviendo y explorando en el mundo compartido',
  },
  mining: {
    label: 'Minería',
    icon: Pickaxe,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} bloques`,
    description: 'Bloques y minerales excavados en cavernas y minas del servidor',
  },
  diamonds: {
    label: 'Diamantes',
    icon: Gem,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} 💎`,
    description: 'Menas de diamantes encontradas y picadas bajo tierra',
  },
  kills: {
    label: 'Cazadores PVE',
    icon: Sword,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} mobs`,
    description: 'Monstruos, jefes y criaturas hostiles eliminadas en combate',
  },
  building: {
    label: 'Construcción',
    icon: Hammer,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} bloques`,
    description: 'Bloques colocados en casas, murallas y proyectos de Pueblo Pollito',
  },
  deaths: {
    label: 'Rey del Respawn',
    icon: Skull,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} muertes`,
    description: 'Los más caídos en batalla, lava y caídas (¡Muro de los Fails!)',
  },
  distance: {
    label: 'Exploradores',
    icon: Compass,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} km`,
    description: 'Kilómetros recorridos a pie, nadando, a caballo y con Elytras',
  },
  sleeps: {
    label: 'Dormilones',
    icon: BedDouble,
    formatter: (v: number) => `${v.toLocaleString('es-PE')} noches`,
    description: 'Veces que usaron la cama para pasar la noche y evitar fantasmas',
  },
};

export function MinecraftTopsSection() {
  const [metric, setMetric] = useState<MinecraftMetric>('playtime');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/minecraft/leaderboard?metric=${metric}`)
      .then((res) => res.json())
      .then((data: { leaderboard?: LeaderboardEntry[] }) => {
        if (active && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [metric]);

  const currentConfig = METRIC_CONFIG[metric];

  const getMetricValue = (entry: LeaderboardEntry) => {
    if (metric === 'mining') return entry.stats.blocks_mined;
    if (metric === 'diamonds') return entry.stats.diamonds_mined;
    if (metric === 'kills') return entry.stats.mobs_killed;
    if (metric === 'building') return entry.stats.blocks_placed;
    if (metric === 'deaths') return entry.stats.deaths;
    if (metric === 'distance') return entry.stats.distance_km;
    if (metric === 'sleeps') return entry.stats.sleeps;
    return entry.stats.playtime_hours;
  };

  const maxValue = leaderboard[0] ? getMetricValue(leaderboard[0]) : 1;

  const userEntry = leaderboard.find((e) => 
    (currentUserId && e.user_id === currentUserId) || 
    (currentUserId && e.username.toLowerCase().includes('milumon'))
  );

  const topThree = leaderboard.slice(0, 3);
  const restList = leaderboard.slice(3);

  const filteredRestList = useMemo(() => {
    if (!searchQuery.trim()) return restList;
    const q = searchQuery.toLowerCase().trim();
    return restList.filter((entry) => 
      entry.username.toLowerCase().includes(q) ||
      (entry.roblox_user && entry.roblox_user.toLowerCase().includes(q)) ||
      (entry.roblox_display_name && entry.roblox_display_name.toLowerCase().includes(q))
    );
  }, [restList, searchQuery]);

  const displayedList = searchQuery.trim() || isExpanded
    ? filteredRestList
    : filteredRestList.slice(0, 6);

  return (
    <section className="space-y-6">
      {/* Centered Header */}
      <div className="text-center space-y-2">
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-[#2D3139] flex items-center justify-center gap-2">
          🏆 Tops & Récords del Servidor
        </h2>
        <p className="font-sans text-xs sm:text-sm text-gray-500 font-bold max-w-xl mx-auto">
          {currentConfig.description}
        </p>
      </div>

      {/* Category Pills (Segmented Selector) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto">
        {(Object.keys(METRIC_CONFIG) as MinecraftMetric[]).map((key) => {
          const cfg = METRIC_CONFIG[key];
          const Icon = cfg.icon;
          const isActive = metric === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMetric(key);
                setSearchQuery('');
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl font-display text-xs font-black transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FFD500] text-black shadow-[3px_3px_0_#D4A000] -translate-y-0.5'
                  : 'bg-white border-2 border-[#E8DFC5] text-[#64748B] hover:border-[#FFD500] hover:text-black'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ─── 2-Column Grid Layout: Leaderboard (Left) + User Performance Card (Right) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Podio 3D + Tabla (Lg: 8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-3xl border-2 border-neutral-800 bg-[#141517] p-4 sm:p-6 shadow-2xl text-white space-y-6">
            {loading ? (
              <div className="py-20 text-center text-xs font-bold uppercase tracking-widest text-[#FFC200] animate-pulse">
                Consultando estadísticas de Minecraft...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center bg-neutral-900 border border-dashed border-neutral-700 rounded-2xl p-6">
                <p className="font-bold text-gray-300 text-sm">Sin jugadores registrados aún en esta categoría.</p>
              </div>
            ) : (
              <>
                {/* 3D Dark Minecraft Podium */}
                {topThree.length >= 3 && !searchQuery.trim() && (
                  <div className="relative overflow-hidden rounded-2xl border border-neutral-700/80 bg-linear-to-b from-[#1c1e22] via-[#16171a] to-[#121315] p-3 sm:p-6 shadow-inner">
                    <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-yellow-500/10 rounded-full blur-3xl" />

                    <div className="relative z-10 flex items-end justify-center gap-1 sm:gap-4 pt-2 sm:pt-4">
                      {/* #2 Subcampeón */}
                      <MinecraftPodiumCard
                        entry={topThree[1]}
                        rank={2}
                        valueText={currentConfig.formatter(getMetricValue(topThree[1]))}
                        isCurrentUser={Boolean(userEntry && userEntry.id === topThree[1].id)}
                      />

                      {/* #1 Campeón MVP */}
                      <MinecraftPodiumCard
                        entry={topThree[0]}
                        rank={1}
                        valueText={currentConfig.formatter(getMetricValue(topThree[0]))}
                        isCurrentUser={Boolean(userEntry && userEntry.id === topThree[0].id)}
                      />

                      {/* #3 Tercer Lugar */}
                      <MinecraftPodiumCard
                        entry={topThree[2]}
                        rank={3}
                        valueText={currentConfig.formatter(getMetricValue(topThree[2]))}
                        isCurrentUser={Boolean(userEntry && userEntry.id === topThree[2].id)}
                      />
                    </div>
                  </div>
                )}

                {/* Table Header with Search Bar */}
                <div className="space-y-4 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-[#FFD500]" />
                      <h3 className="font-display font-black text-sm uppercase tracking-wider text-gray-200">
                        {searchQuery.trim() ? `Resultados (${filteredRestList.length})` : 'Tabla de Récords'}
                      </h3>
                    </div>

                    {/* Search Bar in Dark Gamer Theme */}
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar jugador..."
                        className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-neutral-700 bg-neutral-900 text-xs font-medium text-white placeholder-gray-500 outline-none focus:border-[#FFD500] transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rows */}
                  {displayedList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-500 font-medium">
                      No se encontraron jugadores que coincidan con &quot;{searchQuery}&quot;.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {displayedList.map((entry) => {
                        const rawVal = getMetricValue(entry);
                        const percent = Math.min(100, Math.max(10, Math.round((rawVal / maxValue) * 100)));
                        const isTopTen = entry.position <= 10;
                        const isUser = Boolean(userEntry && userEntry.id === entry.id);

                        return (
                          <div
                            key={entry.id}
                            className={`rounded-xl border p-2.5 sm:px-3.5 transition-all ${
                              isUser
                                ? 'border-[#FFD500] bg-[#221f14] shadow-[0_0_12px_rgba(255,213,0,0.15)] ring-1 ring-[#FFD500]'
                                : isTopTen
                                ? 'border-neutral-700/80 bg-neutral-900/90 hover:border-neutral-600'
                                : 'border-neutral-800 bg-[#16171a] hover:border-neutral-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {/* Position + Avatar + Name */}
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-black ${
                                    isUser
                                      ? 'bg-[#FFD500] text-black shadow-xs'
                                      : isTopTen
                                      ? 'bg-neutral-800 text-[#FFD500] border border-neutral-700'
                                      : 'bg-neutral-800 text-gray-400'
                                  }`}
                                >
                                  #{entry.position}
                                </div>

                                <div className="relative h-7 w-7 sm:h-8 sm:w-8 shrink-0 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800">
                                  <img
                                    src={entry.minecraft_avatar_url}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-full w-full object-cover"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className={`truncate text-xs sm:text-sm font-black ${isUser ? 'text-[#FFD500]' : 'text-gray-100'}`}>
                                      {entry.username}
                                    </p>
                                    {isUser && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-[#FFD500] text-black text-[8px] font-black uppercase">
                                        ⭐ TÚ
                                      </span>
                                    )}
                                    <span className="shrink-0 text-[9px] font-bold text-gray-400">
                                      {entry.edition === 'java' ? '☕ Java' : '📱 Bedrock'}
                                    </span>
                                  </div>
                                  <p className="truncate text-[10px] text-gray-500">
                                    @{entry.roblox_user || 'comunidad'}
                                  </p>
                                </div>
                              </div>

                              {/* Value Capsule */}
                              <div className="shrink-0 text-right">
                                <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${
                                  isUser
                                    ? 'bg-[#FFD500] text-black shadow-xs'
                                    : 'bg-neutral-800 text-gray-200 border border-neutral-700'
                                }`}>
                                  {currentConfig.formatter(rawVal)}
                                </span>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-2 w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isUser
                                    ? 'bg-linear-to-r from-amber-400 to-[#FFD500]'
                                    : 'bg-linear-to-r from-neutral-500 to-[#FFD500]'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Expand button */}
                  {!searchQuery.trim() && filteredRestList.length > 6 && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-xs font-bold text-gray-300 hover:text-white hover:border-[#FFD500] transition cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 text-[#FFD500]" /> Mostrar Top 10
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 text-[#FFD500]" /> Ver todos ({leaderboard.length} jugadores)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: User Performance & Gaming Passport (Lg: 4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {userEntry ? (
            <div className="rounded-3xl border-2 border-[#FFD500]/80 bg-[#141517] p-5 sm:p-6 shadow-2xl text-white space-y-5">
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FFD500] shadow-[0_0_8px_#FFD500]" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-gray-200">
                    Tu Rendimiento
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#FFD500]/20 border border-[#FFD500]/40 text-[#FFD500] text-[10px] font-black">
                  #{userEntry.position} en {currentConfig.label}
                </span>
              </div>

              {/* Player Profile Card */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-neutral-900 border border-neutral-800">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-[#FFD500] bg-neutral-950">
                  <img
                    src={userEntry.minecraft_avatar_url}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-display font-black text-sm text-white truncate">
                    {userEntry.username}
                  </h4>
                  <p className="text-[11px] text-gray-400 truncate">
                    {userEntry.edition === 'java' ? '☕ Java' : '📱 Bedrock'} · @{userEntry.roblox_user || 'comunidad'}
                  </p>
                  <span className="inline-block mt-1 text-[9px] font-bold text-[#FFD500] uppercase tracking-wider">
                    {userEntry.minecraft_rank === 'pollito_admin' ? '👑 Admin Oficial' : '🐣 Miembro Oficial'}
                  </span>
                </div>
              </div>

              {/* Current Active Stat Score Highlight */}
              <div className="p-3.5 rounded-2xl bg-linear-to-r from-amber-500/10 via-yellow-500/10 to-transparent border border-yellow-500/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Récord en {currentConfig.label}
                </p>
                <p className="font-mono text-2xl font-black text-[#FFD500] mt-0.5">
                  {currentConfig.formatter(getMetricValue(userEntry))}
                </p>
              </div>

              {/* Full Game Passport Metrics */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#FFD500]" /> Estadísticas Globales
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                    <p className="text-[10px] text-gray-500">⏱️ Playtime</p>
                    <p className="font-mono font-bold text-gray-200 mt-0.5">{userEntry.stats.playtime_hours} hrs</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                    <p className="text-[10px] text-gray-500">⛏️ Minados</p>
                    <p className="font-mono font-bold text-gray-200 mt-0.5">{userEntry.stats.blocks_mined.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                    <p className="text-[10px] text-gray-500">💎 Diamantes</p>
                    <p className="font-mono font-bold text-cyan-400 mt-0.5">{userEntry.stats.diamonds_mined} 💎</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                    <p className="text-[10px] text-gray-500">⚔️ Mobs</p>
                    <p className="font-mono font-bold text-red-400 mt-0.5">{userEntry.stats.mobs_killed.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                    <p className="text-[10px] text-gray-500">🏗️ Colocados</p>
                    <p className="font-mono font-bold text-emerald-400 mt-0.5">{userEntry.stats.blocks_placed.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                    <p className="text-[10px] text-gray-500">💀 Muertes</p>
                    <p className="font-mono font-bold text-purple-400 mt-0.5">{userEntry.stats.deaths}</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Link
                href="/minecraft/link"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFD500] text-black font-display text-xs font-black hover:brightness-105 transition cursor-pointer shadow-sm"
              >
                ⚙️ Vincular otra cuenta o modificar <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-neutral-800 bg-[#141517] p-5 sm:p-6 shadow-2xl text-white space-y-4 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[#FFD500]/10 border border-[#FFD500]/30 text-[#FFD500] flex items-center justify-center mx-auto text-xl">
                🎮
              </div>
              <div>
                <h4 className="font-display font-black text-sm text-white">¿Quieres figurar en los Tops?</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Inicia sesión y vincula tu cuenta de Minecraft Java o Bedrock para rastrear tus récords en tiempo real.
                </p>
              </div>
              <Link
                href="/acceso?returnTo=/minecraft"
                className="w-full inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-[#FFD500] text-black font-display text-xs font-black hover:brightness-105 transition"
              >
                Ingresar a mi cuenta
              </Link>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

function MinecraftPodiumCard({
  entry,
  rank,
  valueText,
  isCurrentUser = false,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  valueText: string;
  isCurrentUser?: boolean;
}) {
  const isChampion = rank === 1;
  const rankStyles = {
    1: {
      height: 'h-24 sm:h-36',
      gradient: 'from-[#FFD700] via-[#FFB800] to-[#E69500]',
      border: 'border-yellow-400',
      ring: 'ring-2 sm:ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(255,213,0,0.4)]',
      tag: '👑 MVP',
      tagColor: 'bg-yellow-400 text-black font-black',
      avatarSize: 'h-12 w-12 sm:h-16 sm:w-16',
      label: '#1',
      title: 'CAMPEÓN',
    },
    2: {
      height: 'h-18 sm:h-26',
      gradient: 'from-[#E2E8F0] via-[#CBD5E1] to-[#94A3B8]',
      border: 'border-slate-400',
      ring: 'ring-2 ring-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.25)]',
      tag: '🥈 2do',
      tagColor: 'bg-slate-200 text-slate-800 font-bold',
      avatarSize: 'h-9 w-9 sm:h-13 sm:w-13',
      label: '#2',
      title: '2DO',
    },
    3: {
      height: 'h-14 sm:h-20',
      gradient: 'from-[#FDBA74] via-[#FB923C] to-[#C2410C]',
      border: 'border-orange-400',
      ring: 'ring-2 ring-amber-500 shadow-[0_0_12px_rgba(251,146,60,0.25)]',
      tag: '🥉 3ro',
      tagColor: 'bg-amber-100 text-amber-900 font-bold',
      avatarSize: 'h-9 w-9 sm:h-13 sm:w-13',
      label: '#3',
      title: '3RO',
    },
  }[rank];

  return (
    <div
      className={`podium-col flex flex-1 flex-col items-center max-w-[32%] sm:max-w-[150px] min-w-0 transition-transform duration-300 ${
        isChampion ? 'z-20' : 'z-10'
      }`}
    >
      {/* Top Badge */}
      <div className="relative mb-1 sm:mb-1.5 flex flex-col items-center">
        {isChampion ? (
          <div className="animate-bounce mb-0.5 flex items-center justify-center">
            <span className="text-lg sm:text-2xl drop-shadow-[0_4px_8px_rgba(255,213,0,0.5)]">👑</span>
          </div>
        ) : (
          <div className="h-4 sm:h-5 flex items-center">
            <span className="text-xs sm:text-base">{rank === 2 ? '🥈' : '🥉'}</span>
          </div>
        )}

        {/* Minecraft Head Avatar */}
        <div className={`relative ${rankStyles.avatarSize} rounded-2xl ${rankStyles.ring} bg-neutral-900 overflow-hidden`}>
          <img
            src={entry.minecraft_avatar_url}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          {isChampion && (
            <Sparkles className="absolute top-0.5 right-0.5 w-3 h-3 text-yellow-300 animate-pulse drop-shadow-xs" />
          )}
        </div>

        {/* Position Tag */}
        <span className={`absolute -bottom-2 px-1.5 sm:px-2 py-0.2 rounded-full text-[7px] sm:text-[9px] uppercase tracking-wider shadow-xs ${
          isCurrentUser ? 'bg-[#FFD500] text-black font-black' : rankStyles.tagColor
        }`}>
          {isCurrentUser ? '⭐ TÚ' : rankStyles.tag}
        </span>
      </div>

      {/* Username */}
      <div className="mt-2 mb-0.5 text-center w-full px-0.5 overflow-hidden">
        <p className={`truncate font-black leading-tight ${isCurrentUser ? 'text-[#FFD500]' : 'text-gray-100'} ${isChampion ? 'text-[11px] sm:text-sm' : 'text-[10px] sm:text-xs'}`} title={entry.username}>
          {entry.username}
        </p>
        <p className="text-[7px] sm:text-[9px] text-gray-400 truncate">
          {entry.edition === 'java' ? '☕ Java' : '📱 Bedrock'}
        </p>
      </div>

      {/* Score Capsule */}
      <div className="mb-1.5 w-full px-0.5 flex justify-center">
        <span className={`inline-block truncate max-w-full px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-md sm:rounded-lg text-[8px] sm:text-[10px] font-mono font-bold tracking-tight shadow-2xs ${
          isChampion
            ? 'bg-[#FFD500] text-black'
            : isCurrentUser
            ? 'bg-[#FFD500] text-black font-black'
            : 'bg-neutral-800 text-gray-200 border border-neutral-700'
        }`}>
          {valueText}
        </span>
      </div>

      {/* Pedestal */}
      <div
        className={`relative w-full ${rankStyles.height} rounded-t-xl bg-linear-to-b ${rankStyles.gradient} shadow-md border border-b-0 ${rankStyles.border} flex flex-col items-center justify-between p-1 sm:p-2 overflow-hidden`}
      >
        <div className="absolute inset-x-0 top-0 h-6 bg-linear-to-b from-white/30 to-transparent pointer-events-none" />
        <span className="text-lg sm:text-3xl font-black text-black/20 select-none font-display">
          {rankStyles.label}
        </span>
        <span className="text-[6px] sm:text-[8px] font-black uppercase tracking-widest text-black/50 truncate w-full text-center">
          {rankStyles.title}
        </span>
      </div>
    </div>
  );
}