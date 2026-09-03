'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type EggSpawn = {
  id: string;
  egg_name: string;
  rarity: string;
  zone: string;
  server_info?: string | null;
  image_url?: string | null;
  created_at: string;
};

const RARITY_THEME: Record<string, {
  label: string;
  accent: string;
  borderColor: string;
  badgeBgDark: string;
  badgeBgLight: string;
  badgeTextDark: string;
  badgeTextLight: string;
  glow: string;
}> = {
  secret: {
    label: 'Secreto',
    accent: '#ECD06F',
    borderColor: 'rgba(236, 208, 111, 0.4)',
    badgeBgDark: 'rgba(209, 72, 54, 0.35)',
    badgeBgLight: '#1d1d1f',
    badgeTextDark: '#FFA07A',
    badgeTextLight: '#ffffff',
    glow: 'rgba(236, 208, 111, 0.5)',
  },
  eternal: {
    label: 'Eterno',
    accent: '#6FB0EC',
    borderColor: 'rgba(111, 176, 236, 0.45)',
    badgeBgDark: 'rgba(59, 130, 246, 0.35)',
    badgeBgLight: '#1e3a8a',
    badgeTextDark: '#93C5FD',
    badgeTextLight: '#ffffff',
    glow: 'rgba(111, 176, 236, 0.55)',
  },
  divine: {
    label: 'Divino',
    accent: '#F6E05E',
    borderColor: 'rgba(246, 224, 94, 0.5)',
    badgeBgDark: 'rgba(234, 179, 8, 0.4)',
    badgeBgLight: '#854d0e',
    badgeTextDark: '#FDE047',
    badgeTextLight: '#ffffff',
    glow: 'rgba(246, 224, 94, 0.6)',
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

function formatCompactTime(createdAtStr: string, nowMs: number): string {
  const createdMs = new Date(createdAtStr).getTime();
  const diffSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));

  if (diffSec < 30) return '¡AHORA!';
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function MonsterWidgetContent() {
  const searchParams = useSearchParams();
  const isLight = searchParams?.get('theme') === 'light';
  const customSize = parseInt(searchParams?.get('size') || '220', 10);
  const sizePx = Number.isNaN(customSize) || customSize < 160 ? 220 : customSize;

  const [spawns, setSpawns] = useState<EggSpawn[]>([]);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isAlerting, setIsAlerting] = useState<boolean>(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // 1. Cargar historial inicial y polling de respaldo
  const fetchSpawns = async () => {
    try {
      const res = await fetch('/api/egg-spawns?limit=8', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          setSpawns(json);
        }
      }
    } catch (e) {
      console.error('Error fetching egg spawns:', e);
    }
  };

  useEffect(() => {
    fetchSpawns();
    const pollInterval = setInterval(fetchSpawns, 6000);
    return () => clearInterval(pollInterval);
  }, []);

  // 2. Suscripción a Realtime INSERT en public.egg_spawns
  useEffect(() => {
    const channel = supabase
      .channel('monster_widget_spawns_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'egg_spawns' },
        (payload) => {
          if (payload.new) {
            const newSpawn = payload.new as EggSpawn;
            setSpawns((prev) => [newSpawn, ...prev.filter((item) => item.id !== newSpawn.id)].slice(0, 8));
            // Saltar de inmediato al nuevo monstruo y activar alerta
            setActiveIndex(0);
            setIsAlerting(true);
            setTimeout(() => setIsAlerting(false), 18000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Tick de tiempo transcurrido
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Mostrar EXCLUSIVAMENTE la última tanda (wave) de spawns
  // Si en la última tanda salió 1 huevo, se muestra solo ese huevo (sin rotar hacia el pasado).
  // Si salieron 2 o 3 juntos en la misma tanda (ventana de 2 minutos), rota entre ellos.
  const displayEggs = useMemo(() => {
    if (spawns.length === 0) return [];
    const newestTime = new Date(spawns[0].created_at).getTime();
    const BATCH_WINDOW_MS = 2 * 60 * 1000; // 2 minutos de tolerancia para la misma tanda

    return spawns.filter((s) => {
      const sTime = new Date(s.created_at).getTime();
      return Math.abs(newestTime - sTime) <= BATCH_WINDOW_MS;
    });
  }, [spawns]);

  // 5. Rotación suave cada 5 segundos
  useEffect(() => {
    if (displayEggs.length <= 1 || isAlerting) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % displayEggs.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [displayEggs.length, isAlerting]);

  const currentEgg = displayEggs[activeIndex % Math.max(1, displayEggs.length)] || spawns[0] || null;

  if (!currentEgg) {
    return (
      <div
        style={{
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isLight ? '#ffffff' : 'rgba(15, 15, 18, 0.85)',
          borderRadius: '14px',
          border: isLight ? '1px solid #ececef' : '1px solid rgba(255, 255, 255, 0.1)',
          color: isLight ? '#8b8b93' : '#6b6b73',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Esperando spawns...
      </div>
    );
  }

  const rarityKey = normalizeRarity(currentEgg.rarity);
  const theme = RARITY_THEME[rarityKey];
  const hasValidImage = currentEgg.image_url && !failedImages.has(currentEgg.image_url);
  const timeText = isAlerting ? '¡AHORA!' : formatCompactTime(currentEgg.created_at, nowMs);

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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        userSelect: 'none',
      }}
    >
      <div
        id="widget"
        style={{
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          position: 'relative',
        }}
      >
        <div
          className="card"
          style={{
            position: 'absolute',
            inset: 0,
            background: isLight
              ? '#ffffff'
              : 'rgba(13, 13, 16, 0.92)',
            backdropFilter: isLight ? 'none' : 'blur(16px)',
            WebkitBackdropFilter: isLight ? 'none' : 'blur(16px)',
            borderRadius: '14px',
            border: isLight
              ? '1px solid #ececef'
              : `1px solid ${isAlerting ? theme.accent : theme.borderColor}`,
            boxShadow: isAlerting
              ? `0 0 30px ${theme.glow}, 0 4px 20px rgba(0,0,0,0.8)`
              : isLight
                ? '0 2px 12px rgba(0,0,0,0.12)'
                : `0 8px 25px rgba(0,0,0,0.7), 0 0 12px ${theme.borderColor}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'opacity 0.35s ease, transform 0.35s ease, border-color 0.35s ease',
            transform: isAlerting ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          {/* Tag de Rareza (Top Left) */}
          <div
            className="tag"
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: isLight ? theme.badgeBgLight : theme.badgeBgDark,
              color: isLight ? theme.badgeTextLight : theme.badgeTextDark,
              border: isLight ? 'none' : `0.5px solid ${theme.accent}`,
              fontSize: '9px',
              fontWeight: 800,
              padding: '3px 7px',
              borderRadius: '5px',
              letterSpacing: '0.4px',
              zIndex: 2,
              textTransform: 'uppercase',
              boxShadow: isAlerting ? `0 0 8px ${theme.glow}` : 'none',
            }}
          >
            {theme.label}
          </div>

          {/* Tiempo Transcurrido (Top Right) */}
          <div
            className="time"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: isAlerting
                ? '#ef4444'
                : isLight
                  ? 'rgba(255, 255, 255, 0.92)'
                  : 'rgba(255, 255, 255, 0.1)',
              color: isAlerting
                ? '#ffffff'
                : isLight
                  ? '#6b6b73'
                  : 'rgba(255, 255, 255, 0.8)',
              fontSize: '9px',
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: '5px',
              zIndex: 2,
              letterSpacing: '0.2px',
              boxShadow: isAlerting ? '0 0 10px rgba(239, 68, 68, 0.6)' : 'none',
            }}
          >
            {timeText}
          </div>

          {/* Thumbnail Centrado del Monstruo / Huevo */}
          <div
            className="thumb"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              paddingTop: '26px',
              paddingBottom: '4px',
            }}
          >
            {hasValidImage ? (
              <img
                src={currentEgg.image_url!}
                alt={currentEgg.egg_name}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (currentEgg.image_url) {
                    setFailedImages((prev) => new Set(prev).add(currentEgg.image_url!));
                  }
                }}
                style={{
                  width: `${Math.round(sizePx * 0.48)}px`,
                  height: `${Math.round(sizePx * 0.48)}px`,
                  objectFit: 'contain',
                  filter: isLight
                    ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))'
                    : `drop-shadow(0 0 16px ${theme.glow})`,
                  transform: isAlerting ? 'scale(1.12)' : 'scale(1)',
                  transition: 'transform 0.3s ease, filter 0.3s ease',
                  display: 'block',
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: `${Math.round(sizePx * 0.3)}px`,
                  lineHeight: 1,
                  filter: isLight ? 'none' : `drop-shadow(0 0 12px ${theme.glow})`,
                }}
              >
                🥚
              </span>
            )}
          </div>

          {/* Información del Monstruo (Name + Zona) */}
          <div
            className="info"
            style={{
              padding: '6px 11px 8px',
              textAlign: 'left',
            }}
          >
            <div
              className="name"
              style={{
                fontSize: sizePx >= 220 ? '15px' : '13px',
                fontWeight: 800,
                color: isLight ? '#1d1d1f' : '#ffffff',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {toTitleCase(currentEgg.egg_name)}
            </div>
            <div
              className="parents"
              style={{
                fontSize: sizePx >= 220 ? '11px' : '10px',
                color: isLight ? '#8b8b93' : 'rgba(255, 255, 255, 0.55)',
                fontWeight: 600,
                marginTop: '3px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>📍</span>
              <span>{toTitleCase(currentEgg.zone)}</span>
            </div>
          </div>

          {/* Puntos Indicadores de Carrusel */}
          {displayEggs.length > 1 && (
            <div
              className="dots"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px',
                paddingBottom: '8px',
              }}
            >
              {displayEggs.map((egg, i) => {
                const isActive = i === (activeIndex % displayEggs.length);
                return (
                  <div
                    key={egg.id || i}
                    className={`dot ${isActive ? 'active' : ''}`}
                    style={{
                      width: isActive ? '14px' : '5px',
                      height: '5px',
                      borderRadius: isActive ? '3px' : '50%',
                      background: isActive
                        ? isLight
                          ? '#1d1d1f'
                          : theme.accent
                        : isLight
                          ? '#d1d1d6'
                          : 'rgba(255, 255, 255, 0.25)',
                      transition: 'width 0.25s ease, background 0.25s ease',
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EggSpawnsOverlay() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: '220px',
            height: '220px',
            background: 'rgba(13, 13, 16, 0.92)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '12px',
          }}
        >
          Cargando overlay...
        </div>
      }
    >
      <MonsterWidgetContent />
    </Suspense>
  );
}
