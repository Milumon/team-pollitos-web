'use client';

import React, { useState, useEffect } from 'react';
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
  iconBg: string;
  badgeBg: string;
  badgeText: string;
  dividerColor: string;
  glow: string;
}> = {
  secret: {
    label: 'Secreto',
    accent: '#ECD06F',
    borderColor: 'rgba(236, 208, 111, 0.35)',
    iconBg: 'rgba(236, 208, 111, 0.15)',
    badgeBg: 'rgba(209, 72, 54, 0.28)',
    badgeText: '#E8846F',
    dividerColor: 'rgba(236, 208, 111, 0.2)',
    glow: 'rgba(236, 208, 111, 0.4)',
  },
  eternal: {
    label: 'Eterno',
    accent: '#6FB0EC',
    borderColor: 'rgba(111, 176, 236, 0.4)',
    iconBg: 'rgba(111, 176, 236, 0.15)',
    badgeBg: 'rgba(59, 130, 246, 0.28)',
    badgeText: '#93C5FD',
    dividerColor: 'rgba(111, 176, 236, 0.2)',
    glow: 'rgba(111, 176, 236, 0.45)',
  },
  divine: {
    label: 'Divino',
    accent: '#F6E05E',
    borderColor: 'rgba(246, 224, 94, 0.45)',
    iconBg: 'rgba(246, 224, 94, 0.18)',
    badgeBg: 'rgba(234, 179, 8, 0.35)',
    badgeText: '#FDE047',
    dividerColor: 'rgba(246, 224, 94, 0.25)',
    glow: 'rgba(246, 224, 94, 0.5)',
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

function formatTimeAgo(createdAtStr: string, nowMs: number): string {
  const createdMs = new Date(createdAtStr).getTime();
  const diffSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));

  if (diffSec < 45) return '¡Recién salido!';
  if (diffSec < 60) return `Hace ${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  return `Hace ${hours}h ${mins % 60}m`;
}

export default function EggSpawnsOverlay() {
  const [spawns, setSpawns] = useState<EggSpawn[]>([]);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [isAlerting, setIsAlerting] = useState<boolean>(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [activeCarouselIdx, setActiveCarouselIdx] = useState<number>(0);

  // 1. Cargar historial inicial y polling de respaldo
  const fetchSpawns = async () => {
    try {
      const res = await fetch('/api/egg-spawns?limit=6', { cache: 'no-store' });
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
    const pollInterval = setInterval(fetchSpawns, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // 2. Suscripción a Realtime INSERT en public.egg_spawns
  useEffect(() => {
    const channel = supabase
      .channel('egg_spawns_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'egg_spawns' },
        (payload) => {
          if (payload.new) {
            const newSpawn = payload.new as EggSpawn;
            setSpawns((prev) => [newSpawn, ...prev.filter((item) => item.id !== newSpawn.id)].slice(0, 6));
            // Forzar mostrar el nuevo spawn en pantalla principal
            setActiveCarouselIdx(0);
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

  // 4. Carrusel automático cuando hay múltiples huevos activos en el mapa (<25 min)
  const activeEggs = spawns.filter((s) => {
    const ageMin = (nowMs - new Date(s.created_at).getTime()) / (1000 * 60);
    return ageMin <= 25; // Considerados activos en el mapa
  });

  useEffect(() => {
    if (activeEggs.length <= 1 || isAlerting) return;

    const carouselInterval = setInterval(() => {
      setActiveCarouselIdx((prev) => (prev + 1) % activeEggs.length);
    }, 6000); // Rota suavemente cada 6 segundos

    return () => clearInterval(carouselInterval);
  }, [activeEggs.length, isAlerting]);

  // Selección del huevo en pantalla principal
  const currentSpawn = (activeEggs.length > 0 ? activeEggs[activeCarouselIdx % activeEggs.length] : spawns[0]) || null;
  const rarityKey = normalizeRarity(currentSpawn?.rarity);
  const theme = RARITY_THEME[rarityKey];

  // Mini lista de los otros huevos
  const otherSpawns = spawns.filter((s) => s.id !== currentSpawn?.id).slice(0, 2);

  const hasValidImage = currentSpawn?.image_url && !failedImages.has(currentSpawn.image_url);

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
      {/* Tarjeta de Spawns */}
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
          boxShadow: isAlerting
            ? `0 0 35px ${theme.glow}, 0 8px 32px rgba(0, 0, 0, 0.8)`
            : `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px ${theme.borderColor}`,
          transition: 'all 0.4s ease',
          transform: isAlerting ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        {/* Nivel 1: Huevo Aparecido Principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Icono / Imagen con Glow y Fallback Seguro */}
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: theme.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `0.5px solid ${theme.dividerColor}`,
              boxShadow: isAlerting ? `0 0 15px ${theme.glow}` : 'none',
              overflow: 'hidden',
              padding: hasValidImage ? '2px' : '0',
            }}
          >
            {hasValidImage ? (
              <img
                src={currentSpawn.image_url!}
                alt={currentSpawn.egg_name}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (currentSpawn.image_url) {
                    setFailedImages((prev) => new Set(prev).add(currentSpawn.image_url!));
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  display: 'block',
                  transform: isAlerting ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.3s ease',
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: '22px',
                  color: theme.accent,
                  display: 'inline-block',
                  transform: isAlerting ? 'scale(1.2)' : 'scale(1)',
                  transition: 'transform 0.3s ease',
                }}
              >
                🥚
              </span>
            )}
          </div>

          {/* Información del Huevo */}
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
                {currentSpawn ? toTitleCase(currentSpawn.egg_name) : 'Esperando Spawns...'}
              </span>
              {currentSpawn && (
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
              {currentSpawn ? toTitleCase(currentSpawn.zone) : 'Conectando con Discord'}
            </div>
          </div>

          {/* Estado / Tiempo Transcurrido */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontSize: isAlerting ? '13px' : '12px',
                fontWeight: 700,
                lineHeight: 1,
                color: isAlerting ? '#FF4D4D' : theme.accent,
                textShadow: isAlerting ? '0 0 10px rgba(255, 77, 77, 0.6)' : 'none',
                letterSpacing: '-0.3px',
              }}
            >
              {currentSpawn ? (isAlerting ? '🔥 ¡APARECIÓ!' : formatTimeAgo(currentSpawn.created_at, nowMs)) : '--'}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: isAlerting ? '#FF8080' : 'rgba(255, 255, 255, 0.4)',
                marginTop: '3px',
                fontWeight: isAlerting ? 700 : 500,
              }}
            >
              {activeEggs.length > 1 ? `Activo (${(activeCarouselIdx % activeEggs.length) + 1}/${activeEggs.length})` : (isAlerting ? '¡En Vivo!' : 'Spawn Reciente')}
            </div>
          </div>
        </div>

        {/* Separador */}
        <div style={{ height: '0.5px', background: theme.dividerColor }} />

        {/* Nivel 2: Otros Huevos Activos o Recientes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {otherSpawns.length > 0 ? (
            otherSpawns.map((item) => {
              const hRarityKey = normalizeRarity(item.rarity);
              const hTheme = RARITY_THEME[hRarityKey];
              const isItemImgValid = item.image_url && !failedImages.has(item.image_url);

              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isItemImgValid ? (
                    <img
                      src={item.image_url!}
                      alt={item.egg_name}
                      referrerPolicy="no-referrer"
                      onError={() => {
                        if (item.image_url) {
                          setFailedImages((prev) => new Set(prev).add(item.image_url!));
                        }
                      }}
                      style={{
                        width: '18px',
                        height: '18px',
                        objectFit: 'contain',
                        borderRadius: '4px',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '13px', flexShrink: 0 }}>🥚</span>
                  )}
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      width: '100px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {toTitleCase(item.egg_name)}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      color: hTheme.accent,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: 0.85,
                    }}
                  >
                    {toTitleCase(item.zone)}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.45)',
                      width: '65px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {formatTimeAgo(item.created_at, nowMs)}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.35)', textAlign: 'center', padding: '2px 0' }}>
              Registrando apariciones en vivo...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
