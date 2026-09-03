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

// Estilo Cartoon / Gaming dinámico según rareza
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
  const customSize = parseInt(searchParams?.get('size') || '260', 10);
  const sizePx = Number.isNaN(customSize) || customSize < 180 ? 260 : customSize;

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
          padding: '16px',
          background: 'linear-gradient(180deg,#2f6fb0,#1c3f66)',
          border: '3px solid #1a1a1a',
          borderRadius: '14px',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 900,
          fontFamily: "'Arial Black', Arial, sans-serif",
          textAlign: 'center',
          boxShadow: '0 4px 0 #0d1f33',
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
        fontFamily: "'Arial Black', 'Impact', Arial, sans-serif",
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: `${sizePx}px`,
          boxSizing: 'border-box',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
          transform: isAlerting ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Pestaña superior tipo Carpeta / Folder */}
        <div
          style={{
            background: theme.tabGradient,
            border: '3px solid #1a1a1a',
            borderBottom: 'none',
            borderRadius: '12px 12px 0 0',
            padding: '5px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: theme.tabShadow,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#1a1a1a', letterSpacing: '0.4px' }}>
            ÚLTIMA APARICIÓN
          </span>
          {isAlerting && (
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
          )}
        </div>

        {/* Tarjeta principal estilo Cartoon */}
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
          {/* Fila principal: Avatar (SOLO si hay foto) + Nombre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: hasValidImage ? '10px' : '0' }}>
            {hasValidImage && (
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '3px solid #1a1a1a',
                  boxShadow: '0 3px 0 #1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  src={currentEgg.image_url!}
                  alt={currentEgg.egg_name}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedImages((prev) => new Set(prev).add(currentEgg.image_url!))
                  }
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                  }}
                />
              </div>
            )}

            {/* Nombre del Huevo con trazo 3D */}
            <div
              style={{
                fontSize: hasValidImage ? '19px' : '22px',
                fontWeight: 900,
                color: theme.titleColor,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                textShadow:
                  '-1.5px -1.5px 0 #1a1a1a, 1.5px -1.5px 0 #1a1a1a, -1.5px 1.5px 0 #1a1a1a, 1.5px 1.5px 0 #1a1a1a, 0 3px 0 rgba(0,0,0,0.5)',
              }}
            >
              {toTitleCase(currentEgg.egg_name)}
            </div>
          </div>

          {/* Fila inferior de badges: tiempo, rareza, zona */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            {/* Tiempo */}
            <div
              style={{
                background: '#16a34a',
                border: '2px solid #1a1a1a',
                borderRadius: '8px',
                padding: '3px 8px',
                boxShadow: '0 2px 0 #14532d',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '11px', lineHeight: 1 }}>🕐</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#ffffff' }}>{timeText}</span>
            </div>

            {/* Rareza (Emoji Discord: 🔮 / 🌌 / ✨) */}
            <div
              style={{
                background: theme.badgeBg,
                border: '2px solid #1a1a1a',
                borderRadius: '8px',
                padding: '3px 8px',
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

            {/* Zona (Emoji de Bioma Discord) */}
            <div
              style={{
                background: '#0284c7',
                border: '2px solid #1a1a1a',
                borderRadius: '8px',
                padding: '3px 8px',
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
                {toTitleCase(currentEgg.zone)}
              </span>
            </div>
          </div>

          {/* Carrusel de puntos cartoon (si hay varios en la misma tanda) */}
          {displayEggs.length > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '5px',
                marginTop: '10px',
              }}
            >
              {displayEggs.map((egg, i) => {
                const isActive = i === (activeIndex % displayEggs.length);
                return (
                  <div
                    key={egg.id || i}
                    style={{
                      width: isActive ? '16px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: isActive ? '#ffe259' : 'rgba(255, 255, 255, 0.3)',
                      border: '1.5px solid #1a1a1a',
                      boxShadow: isActive ? '0 1.5px 0 #1a1a1a' : 'none',
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
            width: '260px',
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
          Cargando overlay...
        </div>
      }
    >
      <MonsterWidgetContent />
    </Suspense>
  );
}
