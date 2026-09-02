'use client';

import React, { useState, useEffect } from 'react';
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

const RARITY_THEME: Record<string, {
  label: string;
  accent: string;
  borderColor: string;
  iconBg: string;
  badgeBg: string;
  badgeText: string;
  dividerColor: string;
}> = {
  secret: {
    label: 'Secreto',
    accent: '#ECD06F',
    borderColor: 'rgba(236, 208, 111, 0.25)',
    iconBg: 'rgba(236, 208, 111, 0.12)',
    badgeBg: 'rgba(209, 72, 54, 0.25)',
    badgeText: '#E8846F',
    dividerColor: 'rgba(236, 208, 111, 0.15)',
  },
  eternal: {
    label: 'Eterno',
    accent: '#6FB0EC',
    borderColor: 'rgba(111, 176, 236, 0.3)',
    iconBg: 'rgba(111, 176, 236, 0.12)',
    badgeBg: 'rgba(59, 130, 246, 0.25)',
    badgeText: '#93C5FD',
    dividerColor: 'rgba(111, 176, 236, 0.15)',
  },
  divine: {
    label: 'Divino',
    accent: '#F6E05E',
    borderColor: 'rgba(246, 224, 94, 0.35)',
    iconBg: 'rgba(246, 224, 94, 0.15)',
    badgeBg: 'rgba(234, 179, 8, 0.3)',
    badgeText: '#FDE047',
    dividerColor: 'rgba(246, 224, 94, 0.2)',
  },
};

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parsePercentage(probStr: string | undefined): number {
  if (!probStr) return 30;
  const num = parseInt(probStr.replace('%', '').trim(), 10);
  return isNaN(num) ? 30 : Math.min(Math.max(num, 5), 100);
}

export default function EggPredictorOverlay() {
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
  const rarityKey = nextEgg?.rarity?.toLowerCase() || 'secret';
  const theme = RARITY_THEME[rarityKey] || RARITY_THEME.secret;

  const formatCountdown = (secs: number | null) => {
    if (isLive || (secs !== null && secs <= 0)) return '¡AHORA!';
    if (secs === null) return '--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Tarjeta Principal Minimalista */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.90)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `0.5px solid ${theme.borderColor}`,
          borderRadius: '12px',
          padding: '14px 18px',
          width: '350px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px ${theme.borderColor}`,
          transition: 'border 0.4s ease, box-shadow 0.4s ease',
        }}
      >
        {/* Nivel 1: Próximo Huevo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Icono */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: theme.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `0.5px solid ${theme.dividerColor}`,
            }}
          >
            <span
              style={{
                fontSize: '20px',
                color: theme.accent,
                display: 'inline-block',
                transform: isLive ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.3s ease',
              }}
            >
              🥚
            </span>
          </div>

          {/* Información: Nombre, Rareza, Zona y Probabilidad */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '0.2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#ffffff',
                }}
              >
                {nextEgg ? toTitleCase(nextEgg.name) : 'Sincronizando...'}
              </span>
              {nextEgg && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: theme.badgeBg,
                    color: theme.badgeText,
                    flexShrink: 0,
                  }}
                >
                  {theme.label}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.55)',
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {nextEgg ? `${toTitleCase(nextEgg.zone)} · ${nextEgg.probability || '30%'} Prob.` : 'Conectando con Discord'}
            </div>
          </div>

          {/* Cuenta Regresiva */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontSize: isLive ? '18px' : '22px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                color: isLive ? '#FF4D4D' : theme.accent,
                textShadow: isLive ? '0 0 10px rgba(255, 77, 77, 0.6)' : 'none',
                letterSpacing: '-0.5px',
              }}
            >
              {formatCountdown(secondsLeft)}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: isLive ? '#FF8080' : 'rgba(255, 255, 255, 0.4)',
                marginTop: '3px',
                fontWeight: isLive ? 700 : 500,
                textTransform: isLive ? 'uppercase' : 'none',
              }}
            >
              {isLive ? '🔥 ¡EN VIVO!' : 'Robar En Huevo'}
            </div>
          </div>
        </div>

        {/* Separador */}
        <div style={{ height: '0.5px', background: theme.dividerColor }} />

        {/* Nivel 2: Mini Cola con Barras de Probabilidad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {upcomingQueue.length > 0 ? (
            upcomingQueue.map((egg, idx) => {
              const uRarityKey = egg.rarity?.toLowerCase() || 'secret';
              const uTheme = RARITY_THEME[uRarityKey] || RARITY_THEME.secret;
              const probNum = parsePercentage(egg.probability);

              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.65)',
                      width: '95px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {toTitleCase(egg.name)}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: '3px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${probNum}%`,
                        height: '100%',
                        background: uTheme.accent,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.45)',
                      width: '30px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {egg.probability || `${probNum}%`}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.35)', textAlign: 'center', padding: '2px 0' }}>
              Esperando próximas apariciones...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
