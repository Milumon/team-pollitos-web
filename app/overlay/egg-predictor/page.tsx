'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type EggInfo = {
  name: string;
  rarity: 'secret' | 'eternal' | 'divine' | string;
  zone: string;
  target_timestamp: number;
  probability: string;
  is_now?: boolean;
};

type PredictionData = {
  next_egg: EggInfo | null;
  upcoming_eggs: EggInfo[];
  updated_at: string;
};

// Estilo Cartoon Gaming idéntico al Overlay de Spawns
const RARITY_THEME: Record<string, {
  label: string;
  emoji: string;
  cardGradient: string;
  cardBorderColor: string;
  cardShadow: string;
  titleColor: string;
  badgeBg: string;
  badgeShadow: string;
  tabGradient: string;
  tabShadow: string;
  accent: string;
}> = {
  secret: {
    label: 'Secreto',
    emoji: '🔮',
    cardGradient: 'linear-gradient(180deg, #581c87, #2e1065)',
    cardBorderColor: '#1a1a1a',
    cardShadow: '0 5px 0 #180833',
    titleColor: '#ffe259',
    badgeBg: '#7c3aed',
    badgeShadow: '0 2px 0 #4c1d95',
    tabGradient: 'linear-gradient(180deg, #d6f26b, #8fc93a)',
    tabShadow: '0 2px 0 #5b8720',
    accent: '#c084fc',
  },
  eternal: {
    label: 'Eterno',
    emoji: '🌌',
    cardGradient: 'linear-gradient(180deg, #1d4ed8, #0f2b66)',
    cardBorderColor: '#1a1a1a',
    cardShadow: '0 5px 0 #091838',
    titleColor: '#ffe259',
    badgeBg: '#2563eb',
    badgeShadow: '0 2px 0 #1e3a8a',
    tabGradient: 'linear-gradient(180deg, #38bdf8, #0284c7)',
    tabShadow: '0 2px 0 #0369a1',
    accent: '#60a5fa',
  },
  divine: {
    label: 'Divino',
    emoji: '✨',
    cardGradient: 'linear-gradient(180deg, #b45309, #78350f)',
    cardBorderColor: '#1a1a1a',
    cardShadow: '0 5px 0 #451a03',
    titleColor: '#fef08a',
    badgeBg: '#d97706',
    badgeShadow: '0 2px 0 #92400e',
    tabGradient: 'linear-gradient(180deg, #fde047, #eab308)',
    tabShadow: '0 2px 0 #a16207',
    accent: '#facc15',
  },
};

function normalizeRarity(rawRarity: string | undefined): 'secret' | 'eternal' | 'divine' {
  const lower = (rawRarity || '').toLowerCase();
  if (lower.includes('divin')) return 'divine';
  if (lower.includes('etern')) return 'eternal';
  return 'secret';
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getZoneEmoji(zone: string | null | undefined): string {
  if (!zone) return '📍';
  const z = zone.toLowerCase();
  if (z.includes('volcan')) return '🌋';
  if (z.includes('cherry') || z.includes('blossom')) return '🌸';
  if (z.includes('prehistoric')) return '🦖';
  if (z.includes('cosmic') || z.includes('cósmic')) return '🌌';
  if (z.includes('ocean') || z.includes('abyss')) return '🌊';
  if (z.includes('titan') || z.includes('temple')) return '🏛️';
  if (z.includes('snow') || z.includes('ice')) return '❄️';
  if (z.includes('jungle')) return '🌴';
  return '📍';
}

function parsePercentage(probStr: string | undefined): number {
  if (!probStr) return 30;
  const num = parseInt(probStr.replace('%', '').trim(), 10);
  return isNaN(num) ? 30 : Math.min(Math.max(num, 5), 100);
}

function formatCountdown(secs: number | null, isLive: boolean): string {
  if (isLive || (secs !== null && secs <= 0)) return '¡AHORA!';
  if (secs === null) return '--:--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function EggPredictorContent() {
  const searchParams = useSearchParams();
  // Formato vertical más compacto (250px por defecto)
  const customWidth = parseInt(searchParams?.get('width') || searchParams?.get('size') || '250', 10);
  const widthPx = Number.isNaN(customWidth) || customWidth < 180 ? 250 : customWidth;

  const [data, setData] = useState<PredictionData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);

  // 1. Polling de respaldo
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

  // 2. Supabase Realtime
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

  // 3. Countdown milimétrico segundo a segundo
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

      if (diff <= 0 || data.next_egg?.is_now) {
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
  const rarityKey = normalizeRarity(nextEgg?.rarity);
  const theme = RARITY_THEME[rarityKey] || RARITY_THEME.secret;
  const zoneEmoji = getZoneEmoji(nextEgg?.zone);
  const upcomingQueue = (data?.upcoming_eggs || []).slice(0, 2);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '16px',
        margin: 0,
        overflow: 'hidden',
        fontFamily: "'Arial Black', 'Impact', Arial, sans-serif",
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: `${widthPx}px`,
          boxSizing: 'border-box',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
        }}
      >
        {/* Pestaña superior tipo Folder / Carpeta */}
        <div
          style={{
            background: theme.tabGradient,
            border: '3px solid #1a1a1a',
            borderBottom: 'none',
            borderRadius: '12px 12px 0 0',
            padding: '5px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: theme.tabShadow,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#1a1a1a', letterSpacing: '0.4px' }}>
            PRÓXIMO HUEVO
          </span>
          {isLive ? (
            <span
              style={{
                fontSize: '9px',
                background: '#ef4444',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '4px',
                fontWeight: 900,
              }}
            >
              ¡AHORA!
            </span>
          ) : (
            <span
              style={{
                fontSize: '9px',
                background: '#1a1a1a',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '4px',
                fontWeight: 900,
              }}
            >
              PREDICHOS
            </span>
          )}
        </div>

        {/* Tarjeta principal estilo Cartoon (Formato vertical y equilibrado) */}
        <div
          style={{
            background: theme.cardGradient,
            border: `3px solid ${theme.cardBorderColor}`,
            borderRadius: '0 14px 14px 14px',
            padding: '12px 12px 10px',
            boxShadow: theme.cardShadow,
            marginTop: '-3px',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Fila Principal: Nombre a la izquierda + Tiempo Restante al lado derecho (mismo tamaño) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            {/* Nombre del Huevo */}
            <div
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: theme.titleColor,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
                textShadow:
                  '-1.5px -1.5px 0 #1a1a1a, 1.5px -1.5px 0 #1a1a1a, -1.5px 1.5px 0 #1a1a1a, 1.5px 1.5px 0 #1a1a1a, 0 3px 0 rgba(0,0,0,0.5)',
              }}
            >
              {nextEgg ? toTitleCase(nextEgg.name) : 'Sincronizando...'}
            </div>

            {/* Tiempo Restante: Mismo tamaño y relieve 3D, ubicado al lado derecho */}
            <div
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: isLive ? '#ff4d4d' : '#ffffff',
                lineHeight: 1.1,
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
                textShadow: isLive
                  ? '-1.5px -1.5px 0 #1a1a1a, 1.5px -1.5px 0 #1a1a1a, -1.5px 1.5px 0 #1a1a1a, 1.5px 1.5px 0 #1a1a1a, 0 3px 0 rgba(239, 68, 68, 0.6)'
                  : '-1.5px -1.5px 0 #1a1a1a, 1.5px -1.5px 0 #1a1a1a, -1.5px 1.5px 0 #1a1a1a, 1.5px 1.5px 0 #1a1a1a, 0 3px 0 rgba(0,0,0,0.5)',
              }}
            >
              {formatCountdown(secondsLeft, isLive)}
            </div>
          </div>

          {/* Fila de pastillas inferiores: Rareza, Zona y Probabilidad */}
          <div style={{ display: 'flex', gap: '5px', marginTop: '10px', alignItems: 'center' }}>
            {/* Rareza (Emoji Discord: 🔮 / 🌌 / ✨) */}
            <div
              style={{
                background: theme.badgeBg,
                border: '2px solid #1a1a1a',
                borderRadius: '8px',
                padding: '3px 7px',
                boxShadow: theme.badgeShadow,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '11px', lineHeight: 1 }}>{theme.emoji}</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#ffffff' }}>{theme.label}</span>
            </div>

            {/* Zona con Bioma Discord */}
            <div
              style={{
                background: '#0284c7',
                border: '2px solid #1a1a1a',
                borderRadius: '8px',
                padding: '3px 7px',
                boxShadow: '0 2px 0 #075985',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                minWidth: 0,
                flex: 1,
              }}
            >
              <span style={{ fontSize: '11px', lineHeight: 1 }}>{zoneEmoji}</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 900,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {nextEgg ? toTitleCase(nextEgg.zone) : 'Cargando'}
              </span>
            </div>

            {/* Probabilidad */}
            <div
              style={{
                background: '#d97706',
                border: '2px solid #1a1a1a',
                borderRadius: '8px',
                padding: '3px 7px',
                boxShadow: '0 2px 0 #78350f',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '10px', lineHeight: 1 }}>🎯</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#ffffff' }}>
                {nextEgg?.probability || '30%'}
              </span>
            </div>
          </div>

          {/* Sección Inferior: Siguientes en Cola (con barras cartoon) */}
          {upcomingQueue.length > 0 && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '2px solid rgba(26,26,26,0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              <div
                style={{
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  fontWeight: 900,
                }}
              >
                EN COLA DE PREDICCIÓN
              </div>
              {upcomingQueue.map((egg, idx) => {
                const uRarity = normalizeRarity(egg.rarity);
                const uTheme = RARITY_THEME[uRarity];
                const probNum = parsePercentage(egg.probability);

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '3px 6px',
                      borderRadius: '6px',
                      border: '1.5px solid #1a1a1a',
                    }}
                  >
                    <span style={{ fontSize: '11px', flexShrink: 0 }}>{uTheme.emoji}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#ffffff',
                        fontWeight: 900,
                        width: '78px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flexShrink: 0,
                      }}
                    >
                      {toTitleCase(egg.name)}
                    </span>
                    {/* Barra de probabilidad Cartoon */}
                    <div
                      style={{
                        flex: 1,
                        height: '6px',
                        background: '#1a1a1a',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <div
                        style={{
                          width: `${probNum}%`,
                          height: '100%',
                          background: uTheme.accent,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#ffe259',
                        fontWeight: 900,
                        width: '30px',
                        textAlign: 'right',
                        flexShrink: 0,
                      }}
                    >
                      {egg.probability || `${probNum}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EggPredictorOverlay() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: '250px',
            padding: '16px',
            background: '#0a0a0c',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '12px',
          }}
        >
          Cargando predictor...
        </div>
      }
    >
      <EggPredictorContent />
    </Suspense>
  );
}
