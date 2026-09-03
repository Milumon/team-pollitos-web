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

// Cada rareza con sus colores de glow, acento y emojis idénticos a Discord
const RARITY_THEME: Record<string, { label: string; glow: string; emoji: string; accent: string }> = {
  secret: { label: 'Secreto', glow: 'rgba(168, 85, 247, 0.55)', emoji: '🔮', accent: '#c084fc' },
  eternal: { label: 'Eterno', glow: 'rgba(59, 130, 246, 0.55)', emoji: '🌌', accent: '#60a5fa' },
  divine: { label: 'Divino', glow: 'rgba(234, 179, 8, 0.6)', emoji: '✨', accent: '#facc15' },
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

function formatCompactTime(createdAtStr: string, nowMs: number): string {
  const createdMs = new Date(createdAtStr).getTime();
  const diffSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));

  if (diffSec < 30) return 'ahora';
  if (diffSec < 60) return `hace ${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours}h ${mins % 60}m`;
}

function MonsterWidgetContent() {
  const searchParams = useSearchParams();
  const customSize = parseInt(searchParams?.get('size') || '230', 10);
  const sizePx = Number.isNaN(customSize) || customSize < 160 ? 230 : customSize;

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
            setActiveIndex(0);
            setIsAlerting(true);
            setTimeout(() => setIsAlerting(false), 3000);
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
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Mostrar EXCLUSIVAMENTE la última tanda (wave) de spawns
  const displayEggs = useMemo(() => {
    if (spawns.length === 0) return [];
    const newestTime = new Date(spawns[0].created_at).getTime();
    const BATCH_WINDOW_MS = 2 * 60 * 1000;

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
          background: '#0a0a0c',
          borderRadius: '20px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        Esperando spawns...
      </div>
    );
  }

  const rarityKey = normalizeRarity(currentEgg.rarity);
  const theme = RARITY_THEME[rarityKey];
  const hasValidImage = Boolean(currentEgg.image_url && !failedImages.has(currentEgg.image_url));
  const timeText = formatCompactTime(currentEgg.created_at, nowMs);
  const zoneEmoji = getZoneEmoji(currentEgg.zone);

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
        style={{
          width: `${sizePx}px`,
          height: hasValidImage ? `${sizePx}px` : 'auto',
          minHeight: hasValidImage ? `${sizePx}px` : 'auto',
          background: '#0a0a0c',
          borderRadius: '20px',
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid ${isAlerting ? theme.accent : 'rgba(255, 255, 255, 0.08)'}`,
          boxShadow: isAlerting
            ? `0 0 34px ${theme.glow}, 0 8px 25px rgba(0,0,0,0.7)`
            : `0 8px 25px rgba(0,0,0,0.6), 0 0 16px ${theme.glow.replace(/[\d.]+\)$/, '0.25)')}`,
          transform: isAlerting ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease, height 0.35s ease',
        }}
      >
        {/* Glow radial detrás del contenido, color según rareza */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 32%, ${theme.glow.replace(
              /[\d.]+\)$/,
              isAlerting ? '0.32)' : '0.18)'
            )}, transparent 65%)`,
            transition: 'background 0.35s ease',
          }}
        />

        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: hasValidImage ? '20px' : '16px 18px',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          {/* Título: Última aparición + nombre grande */}
          <div style={{ fontSize: sizePx >= 220 ? '13px' : '11px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
            Última aparición
          </div>
          <div
            style={{
              fontSize: sizePx >= 220 ? '26px' : '22px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.5px',
              marginTop: '4px',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {toTitleCase(currentEgg.egg_name)}
          </div>

          {/* Thumbnail / foto solo si existe y es válida (desaparece completamente si no hay foto) */}
          {hasValidImage && (
            <div
              style={{
                width: `${Math.round(sizePx * 0.28)}px`,
                height: `${Math.round(sizePx * 0.28)}px`,
                borderRadius: '50%',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: `${Math.round(sizePx * 0.05)}px`,
                boxShadow: `0 0 22px ${theme.glow}`,
                overflow: 'hidden',
              }}
            >
              <img
                src={currentEgg.image_url!}
                alt={currentEgg.egg_name}
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedImages((prev) => new Set(prev).add(currentEgg.image_url!))
                }
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Fila de datos secundarios con íconos estilo Discord: tiempo, rareza, zona */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: hasValidImage ? `${Math.round(sizePx * 0.07)}px` : '14px',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            {/* Tiempo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '14px' }}>🕐</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{timeText}</span>
            </div>

            {/* Rareza (Emoji Discord: 🔮 / 🌌 / ✨) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '14px' }}>{theme.emoji}</span>
              <span style={{ fontSize: '10px', color: theme.accent, fontWeight: 700 }}>{theme.label}</span>
            </div>

            {/* Zona (Emoji de Bioma Discord: 🌋 / 🌸 / 🦖 / 🌌 / etc.) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', maxWidth: '85px' }}>
              <span style={{ fontSize: '14px' }}>{zoneEmoji}</span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
              >
                {toTitleCase(currentEgg.zone)}
              </span>
            </div>
          </div>

          {/* Puntos de carrusel, solo si hay más de 1 en la misma tanda */}
          {displayEggs.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginTop: hasValidImage ? `${Math.round(sizePx * 0.06)}px` : '12px',
              }}
            >
              {displayEggs.map((egg, i) => {
                const isActive = i === (activeIndex % displayEggs.length);
                return (
                  <div
                    key={egg.id || i}
                    style={{
                      width: isActive ? '14px' : '5px',
                      height: '5px',
                      borderRadius: isActive ? '3px' : '50%',
                      background: isActive ? theme.accent : 'rgba(255,255,255,0.25)',
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
            width: '230px',
            height: '230px',
            background: '#0a0a0c',
            borderRadius: '20px',
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
