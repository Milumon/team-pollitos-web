'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

type EggInfo = {
  name: string;
  rarity: 'secret' | 'eternal' | 'divine' | string;
  zone: string;
  target_timestamp: number;
  probability: string;
};

type PredictionData = {
  next_egg: EggInfo | null;
  upcoming_eggs: EggInfo[];
  updated_at: string;
};

const RARITY_CONFIG: Record<string, {
  label: string;
  emoji: string;
  glow: string;
  border: string;
  bgGradient: string;
  textColor: string;
  badgeBg: string;
}> = {
  secret: {
    label: 'SECRETO',
    emoji: '🔮',
    glow: 'rgba(168, 85, 247, 0.4)',
    border: 'border-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.35)]',
    bgGradient: 'from-purple-950/80 via-slate-900/90 to-purple-900/40',
    textColor: 'text-purple-300',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  eternal: {
    label: 'ETERNO',
    emoji: '🌌',
    glow: 'rgba(59, 130, 246, 0.4)',
    border: 'border-blue-500/60 shadow-[0_0_25px_rgba(59,130,246,0.35)]',
    bgGradient: 'from-blue-950/80 via-slate-900/90 to-cyan-900/40',
    textColor: 'text-blue-300',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  divine: {
    label: 'DIVINO',
    emoji: '✨',
    glow: 'rgba(234, 179, 8, 0.4)',
    border: 'border-amber-400/70 shadow-[0_0_30px_rgba(234,179,8,0.45)]',
    bgGradient: 'from-amber-950/80 via-slate-900/90 to-yellow-900/40',
    textColor: 'text-amber-300',
    badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-400/50',
  },
};

export default function EggPredictorOverlay() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);

  // 1. Cargar datos iniciales y polling
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/egg-predictor', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && (json.next_egg || Array.isArray(json.upcoming_eggs))) {
          setData(json);
        }
      }
    } catch (e) {
      console.error('Error fetching egg predictor:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // 2. Suscribirse a Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel('egg_predictions_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'egg_predictions', filter: 'id=eq.current' },
        (payload) => {
          if (payload.new) {
            setData(payload.new as PredictionData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Cuenta regresiva segundo a segundo
  useEffect(() => {
    if (!data?.next_egg?.target_timestamp) {
      setSecondsLeft(null);
      setIsLive(false);
      return;
    }

    const updateTimer = () => {
      const targetSec = data.next_egg!.target_timestamp;
      const nowSec = Math.floor(Date.now() / 1000);
      const diff = targetSec - nowSec;

      if (diff <= 0) {
        setSecondsLeft(0);
        setIsLive(true);
      } else {
        setSecondsLeft(diff);
        setIsLive(false);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 500);
    return () => clearInterval(timerInterval);
  }, [data]);

  const nextEgg = data?.next_egg;
  const rarityKey = nextEgg?.rarity?.toLowerCase() || 'secret';
  const rarity = RARITY_CONFIG[rarityKey] || RARITY_CONFIG.secret;

  // Formato MM:SS o Horas
  const formatCountdown = (secs: number | null) => {
    if (secs === null) return '--:--';
    if (secs <= 0) return '¡AHORA!';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const upcomingEggs = (data?.upcoming_eggs || []).slice(0, 2);

  if (!nextEgg) {
    return (
      <div className="w-full h-full flex items-center justify-start p-4 font-sans select-none pointer-events-none">
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800/80 shadow-2xl text-slate-300">
          <span className="text-2xl animate-pulse">🥚</span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Predictor de Huevos</span>
            <span className="text-sm font-semibold text-slate-200">Sincronizando próximas apariciones...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-start justify-start p-4 font-sans select-none pointer-events-none overflow-hidden">
      {/* Contenedor Horizontal Principal */}
      <div className="flex items-center gap-3">
        {/* Banner Widget Horizontal */}
        <div
          className={`relative flex items-center gap-4 px-5 py-3 rounded-2xl bg-gradient-to-r ${rarity.bgGradient} backdrop-blur-xl border ${rarity.border} transition-all duration-500 overflow-hidden min-w-[560px] max-w-[680px] h-[92px]`}
        >
          {/* Luz de fondo ambiental */}
          <div
            className="absolute -left-10 -top-10 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-60"
            style={{ backgroundColor: rarity.glow }}
          />

          {/* 1. Icono del Huevo con Glow y Badge */}
          <div className="relative flex-shrink-0 flex flex-col items-center justify-center">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-950/60 border border-white/10 shadow-inner ${
                isLive ? 'animate-bounce' : 'animate-pulse'
              }`}
            >
              <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                🥚
              </span>
            </div>
            <span
              className={`absolute -bottom-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border backdrop-blur-md ${rarity.badgeBg} shadow-sm`}
            >
              {rarity.emoji} {rarity.label}
            </span>
          </div>

          {/* 2. Información del Huevo (Nombre y Zona) */}
          <div className="flex-1 flex flex-col justify-center min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60 font-extrabold flex items-center gap-1">
                PRÓXIMO HUEVO
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-white/10 text-white/80">
                {nextEgg.probability || '99%'} PROB
              </span>
            </div>
            <h1 className="text-xl font-black text-white tracking-wide truncate uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {nextEgg.name}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-white/80 font-semibold truncate">
              <span className="text-emerald-400 font-bold">📍</span>
              <span className="truncate">{nextEgg.zone}</span>
            </div>
          </div>

          {/* 3. Cuenta Regresiva Viva */}
          <div className="flex-shrink-0 flex flex-col items-end justify-center pl-3 border-l border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-white/60 font-bold">
              {isLive ? 'ESTADO' : 'TIEMPO ESTIMADO'}
            </span>
            <div
              className={`text-2xl font-black tracking-tight font-mono drop-shadow-[0_0_12px_${rarity.glow}] ${
                isLive
                  ? 'text-amber-300 animate-pulse font-sans text-xl'
                  : secondsLeft && secondsLeft <= 30
                  ? 'text-red-400 animate-pulse'
                  : 'text-white'
              }`}
            >
              {formatCountdown(secondsLeft)}
            </div>
            <span className="text-[10px] text-white/50 font-medium">
              {isLive ? '🔥 ¡En Vivo!' : 'robarenhuevo'}
            </span>
          </div>
        </div>

        {/* Mini Cola de los 2 Siguientes Huevos (Ticker sutil) */}
        {upcomingEggs.length > 0 && (
          <div className="hidden md:flex flex-col gap-1.5 max-w-[200px]">
            <span className="text-[9px] uppercase tracking-widest text-white/50 font-extrabold pl-1">
              EN COLA:
            </span>
            {upcomingEggs.map((egg, idx) => {
              const uRarity = RARITY_CONFIG[egg.rarity?.toLowerCase()] || RARITY_CONFIG.secret;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-white/90 text-xs shadow-lg"
                >
                  <span className="text-xs">{uRarity.emoji}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold truncate text-[11px] leading-tight text-white">
                      {egg.name}
                    </span>
                    <span className="text-[9px] text-white/60 truncate leading-tight">
                      {egg.zone} • {egg.probability}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
