'use client';

import React from 'react';
import Image from 'next/image';
import { NotificationPopup } from '@/components/overlay/NotificationPopup';

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export type OverlaySettings = {
  overlay_notification_top?: number;
  overlay_notification_left?: number;
  overlay_notification_width?: number;
  overlay_notification_badge_size?: number;
  overlay_notification_content_size?: number;
  overlay_notification_sender_size?: number;
  overlay_media_top?: number;
  overlay_media_left?: number;
  overlay_media_width?: number;
  overlay_media_message_size?: number;
  overlay_media_repeat_count?: number;
  overlay_random_position?: boolean;
};

export type OverlayEvent = {
  id: string;
  type: 'sound' | 'tts' | 'animation' | 'voice' | 'image_audio' | 'video' | 'audio' | 'image';
  content: string;
  sender_roblox_user?: string | null;
  sender_tiktok_user?: string | null;
  sender_avatar_url?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  trim_start?: number | null;
  trim_end?: number | null;
  message?: string | null;
  repeat_enabled?: boolean;
};

export type OverlayParticle = {
  id: number;
  char?: string;
  color?: string;
  size: number;
  left: number;
  delay: number;
  duration: number;
  rotation: number;
};

export type OverlayAnimationType = 'confetti' | 'eggs' | 'sparkles' | null;

// ─── Canvas interno: siempre 720×1280 ───────────────────────────────────────

/**
 * Ancho y alto del canvas de referencia.
 * Coincide con la resolución del overlay en OBS (720×1280, portrait HD).
 */
export const CANVAS_W = 720;
export const CANVAS_H = 1280;

function seededRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface OverlayCanvasProps {
  /**
   * - 'obs'     → overlay real en OBS; muestra banner de mute, botón de
   *               habilitación de audio, fondo transparente.
   * - 'preview' → diseñador en el admin; fondo con cuadrícula, sin estados
   *               de error.
   */
  mode: 'obs' | 'preview';

  /**
   * Factor de escala aplicado al canvas de 720×1280.
   * En OBS siempre es 1. En el diseñador se calcula dinámicamente.
   */
  scale: number;

  /** Configuración visual del pop-up (posición, tamaños de fuente). */
  settings: OverlaySettings;

  /**
   * Evento activo que se muestra en el widget de notificación.
   * null → el widget está oculto.
   */
  event: OverlayEvent | null;

  /** Animación de partículas activa (confetti / eggs / sparkles). */
  animation: OverlayAnimationType;

  /** Partículas para la animación activa. */
  particles: OverlayParticle[];

  /** Si el stream está muteado (solo visible en mode='obs'). */
  isMuted?: boolean;

  /** Si se necesita interacción para desbloquear el audio (solo mode='obs'). */
  needsInteraction?: boolean;

  /** Callback cuando el usuario hace click en "Habilitar Audio" (mode='obs'). */
  onInteraction?: () => void;

  /** Mostrar el popup siempre estático sin animación (para preview mientras se arrastra). */
  staticPreview?: boolean;

  /** Nombre a mostrar en el widget. Si no se pasa usa sender_roblox_user del evento. */
  senderLabel?: string;

  /** Mostrar imagen de guía de diseño de fondo (en modo preview) */
  showBackgroundGuide?: boolean;

  /** Posición forzada del media (override). Usado por el overlay para reposicionamiento dinámico. */
  mediaPosition?: { x: number; y: number };
}

// ─── Componente ─────────────────────────────────────────────────────────────

/**
 * OverlayCanvas — fuente única de verdad para el renderizado del overlay.
 *
 * Siempre se dibuja a 720×1280 internamente.
 * El prop `scale` achica o agranda visualmente todo el canvas de forma uniforme.
 * Las posiciones absolutas (top, width) son en píxeles del canvas real —
 * no hay conversión: el scale ya lo maneja.
 */
export function OverlayCanvas({
  mode,
  scale,
  settings,
  event,
  animation,
  particles,
  isMuted = false,
  needsInteraction = false,
  onInteraction,
  staticPreview = false,
  senderLabel,
  showBackgroundGuide = false,
  mediaPosition,
}: OverlayCanvasProps) {
  const top = settings.overlay_notification_top ?? 48;
  const left = settings.overlay_notification_left ?? 50;
  const width = settings.overlay_notification_width ?? 288;
  const avatarSize = settings.overlay_notification_badge_size ?? 32;
  const contentSize = settings.overlay_notification_content_size ?? 14;
  const senderSize = settings.overlay_notification_sender_size ?? 11;
  const mediaTop = settings.overlay_media_top ?? 48;
  const mediaLeft = settings.overlay_media_left ?? 50;
  const mediaWidth = settings.overlay_media_width ?? 400;
  const messageSize = settings.overlay_media_message_size ?? 12;
  const repeatCount = settings.overlay_media_repeat_count ?? 1;

  const isObs = mode === 'obs';
  const isPreview = mode === 'preview';

  const { randomPos, repeatPositions } = React.useMemo(() => {
    if (!event) return { randomPos: { x: mediaLeft, y: mediaTop }, repeatPositions: [] };

    let randomSeed = Array.from(event.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const nextRandom = () => seededRandom(randomSeed++);

    const effectiveWidth = Math.min(mediaWidth, CANVAS_W * 0.9);
    const maxXPercent = ((CANVAS_W - effectiveWidth) / CANVAS_W) * 100;

    const estimatedMaxHeight = 720;
    const maxY = CANVAS_H - estimatedMaxHeight;
    const minY = 420;

    const shouldRandomize = settings.overlay_random_position || (event.repeat_enabled && repeatCount > 1);
    const basePos = shouldRandomize
      ? { x: nextRandom() * maxXPercent, y: minY + nextRandom() * (maxY - minY) }
      : { x: mediaLeft, y: mediaTop };

    if (event.repeat_enabled && repeatCount > 1) {
      const cols = Math.ceil(Math.sqrt(repeatCount));
      const rows = Math.ceil(repeatCount / cols);

      const validWidth = maxXPercent;
      const validHeight = maxY - minY;
      const cellWidth = validWidth / cols;
      const cellHeight = validHeight / rows;
      const jitterX = cellWidth * 0.12;
      const jitterY = cellHeight * 0.12;

      const positions: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < repeatCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = col * cellWidth + cellWidth / 2;
        const cy = row * cellHeight + cellHeight / 2;
        positions.push({
          x: Math.max(0, Math.min(maxXPercent, cx + (nextRandom() * 2 - 1) * jitterX)),
          y: Math.max(minY, Math.min(maxY, cy + (nextRandom() * 2 - 1) * jitterY)),
        });
      }
      return { randomPos: basePos, repeatPositions: positions };
    }

    return { randomPos: basePos, repeatPositions: [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, event?.repeat_enabled, settings.overlay_random_position, mediaWidth, repeatCount, mediaLeft, mediaTop]);

  const useRepeat = event?.repeat_enabled && repeatCount > 1 && repeatPositions.length > 0;
  const effectiveMediaTop = mediaPosition ? mediaPosition.y : ((useRepeat || settings.overlay_random_position) && event ? randomPos.y : mediaTop);
  const effectiveMediaLeft = mediaPosition ? mediaPosition.x : ((useRepeat || settings.overlay_random_position) && event ? randomPos.x : mediaLeft);

  return (
    /**
     * Wrapper que recorta el canvas al tamaño escalado.
     * width / height vienen de la escala para que el contenedor padre
     * pueda dimensionarse correctamente.
     */
    <div
      style={{
        width: CANVAS_W * scale,
        height: CANVAS_H * scale,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* ─── Canvas real 720×1280, luego escalado ─── */}
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          position: 'absolute',
          top: 0,
          left: 0,
          background: isObs ? 'transparent' : undefined,
          backgroundImage: isPreview && showBackgroundGuide ? 'url("/images/916 vertical layout.png")' : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        className={
          isPreview && !showBackgroundGuide
            ? 'bg-neutral-950 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px]'
            : isPreview
            ? 'bg-neutral-950'
            : ''
        }
      >
        {/* ── Botón habilitación de audio (solo OBS) ── */}
        {isObs && needsInteraction && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center pointer-events-auto z-50 p-6 text-center">
            <button
              onClick={onInteraction}
              className="px-6 py-4 bg-[#FFD700] hover:bg-yellow-300 text-black font-black uppercase text-xs rounded-xl border-2 border-black transition-all flex items-center gap-2 shadow-[4px_4px_0_0_#000] cursor-pointer"
            >
              🔊 Habilitar Audio del Overlay
            </button>
          </div>
        )}

        {/* ── Banner de mute (solo OBS) ── */}
        {isObs && isMuted && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center border-4 border-red-600 animate-pulse z-40">
            <div className="bg-red-600 border-2 border-black p-4 rounded-xl text-white font-black text-sm uppercase tracking-wider shadow-[4px_4px_0_0_#000]">
              🔇 MUTED
            </div>
          </div>
        )}

        {/* ── Indicador de vista previa (solo preview) ── */}
        {isPreview && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 border border-white/10 rounded-full px-3 py-1 text-[10px] text-gray-500 font-mono tracking-widest uppercase z-30 select-none pointer-events-none">
            Preview OBS · 720×1280
          </div>
        )}

        {/* ── Widget de notificación ── */}
        {event && event.type !== 'animation' && event.type !== 'image_audio' && event.type !== 'video' && event.type !== 'image' && (isObs ? !isMuted : true) && (
          <div
            style={{
              top: `${top}px`,
              width: `${width}px`,
              maxWidth: '90%',
              left: `${left}%`,
              transform: 'none',
              position: 'absolute',
            }}
          >
            <NotificationPopup
              event={event}
              avatarSize={avatarSize}
              contentSize={contentSize}
              senderSize={senderSize}
              senderLabel={senderLabel}
              className={staticPreview ? '' : 'animate-slide-in'}
            />
          </div>
        )}

        {/* ── Media display (image_audio / video / image) ── */}
        {event && (event.type === 'image_audio' || event.type === 'video' || event.type === 'image') && (isObs ? !isMuted : true) && (
          <>
            {/* Repeat mode: render N copies at random positions */}
            {useRepeat && repeatPositions.map((pos, idx) => (
              <div
                key={`repeat-${event.id}-${idx}`}
                style={{
                  top: `${pos.y}px`,
                  width: `${mediaWidth}px`,
                  maxWidth: '90%',
                  left: `${pos.x}%`,
                  transform: 'none',
                  position: 'absolute',
                }}
              >
                <div className="relative overflow-hidden rounded-lg shadow-lg">
                  {event.type === 'image_audio' && event.image_url && (
                    <Image src={event.image_url} alt={event.content} width={800} height={600} unoptimized className="w-full object-contain max-h-[50vh] rounded-lg" />
                  )}
                  {event.type === 'video' && event.video_url && (
                    <video src={event.video_url} autoPlay loop={false} playsInline muted={false} className="w-full object-contain max-h-[50vh] rounded-lg"
                      onLoadedMetadata={(e) => { const vid = e.currentTarget; if (event.trim_start && event.trim_start > 0) vid.currentTime = event.trim_start; }}
                      onTimeUpdate={(e) => { const vid = e.currentTarget; if (event.trim_end && event.trim_end > 0 && vid.currentTime >= event.trim_end) vid.pause(); }}
                    />
                  )}
                  {event.type === 'image' && event.image_url && (
                    <Image src={event.image_url} alt={event.content} width={800} height={600} unoptimized className="w-full object-contain max-h-[50vh] rounded-lg" />
                  )}
                </div>
              </div>
            ))}

            {/* Single mode or first position with full popup */}
            {!useRepeat && (
              <div
                style={{
                  top: `${effectiveMediaTop}px`,
                  width: `${mediaWidth}px`,
                  maxWidth: '90%',
                  left: `${effectiveMediaLeft}%`,
                  transform: 'none',
                  position: 'absolute',
                }}
              >
                <div className="relative bg-[#15100a]/92 border border-[#e8a33d]/70 overflow-hidden shadow-[0_0_30px_rgba(245,185,74,0.15)]">
                  {/* corner brackets */}
                  <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-[#f5b94a] pointer-events-none z-10" />
                  <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-[#f5b94a] pointer-events-none z-10" />
                  <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-[#f5b94a] pointer-events-none z-10" />
                  <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-[#f5b94a] pointer-events-none z-10" />

                  {/* live indicator */}
                  <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#f5b94a] animate-pulse pointer-events-none z-10" />

                  {/* Media content */}
                  <div className="p-2">
                    {event.type === 'image_audio' && event.image_url && (
                      <Image src={event.image_url} alt={event.content} width={800} height={600} unoptimized className="w-full object-contain max-h-[50vh] rounded-lg" />
                    )}
                    {event.type === 'video' && event.video_url && (
                      <video src={event.video_url} autoPlay loop={false} playsInline muted={false} className="w-full object-contain max-h-[50vh] rounded-lg"
                        onLoadedMetadata={(e) => { const vid = e.currentTarget; if (event.trim_start && event.trim_start > 0) vid.currentTime = event.trim_start; }}
                        onTimeUpdate={(e) => { const vid = e.currentTarget; if (event.trim_end && event.trim_end > 0 && vid.currentTime >= event.trim_end) vid.pause(); }}
                      />
                    )}
                    {event.type === 'image' && event.image_url && (
                      <Image src={event.image_url} alt={event.content} width={800} height={600} unoptimized className="w-full object-contain max-h-[50vh] rounded-lg" />
                    )}
                  </div>

                  {event.message && (
                    <div className="px-2 pb-1">
                      <p className="font-bold text-white/90 leading-relaxed" style={{ fontSize: `${messageSize}px` }}>
                        {event.message}
                      </p>
                    </div>
                  )}

                  {/* Sender info — same style as NotificationPopup */}
                  <div className="flex items-center gap-2 p-2.5 border-t border-[#e8a33d]/30">
                    {event.sender_avatar_url ? (
                      <div className="w-7 h-7 border border-[#e8a33d]/70 overflow-hidden shrink-0">
                        <Image
                          src={event.sender_avatar_url}
                          alt={event.sender_roblox_user ?? 'VIP'}
                          width={28}
                          height={28}
                          unoptimized
                          className="w-full h-full object-cover"
                          style={{ transform: 'scale(1.6) translateY(-8%)', transformOrigin: 'center top', objectPosition: 'center top' }}
                        />
                      </div>
                    ) : (
                      <div className="w-7 h-7 bg-[#241a10] border border-[#e8a33d]/70 flex items-center justify-center text-sm shrink-0">
                        🐣
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f5b94a] leading-none">
                        &gt;&gt;&gt; {event.type === 'video' ? 'video' : event.type === 'image_audio' ? 'imagen + audio' : 'imagen'}
                      </p>
                      <p className="text-[10px] font-bold text-[#c99a5b] truncate mt-0.5">
                        Por: @{event.sender_roblox_user ?? 'VIP'}
                      </p>
                    </div>
                  </div>

                  {/* bottom filete */}
                  <span className="absolute left-2 right-2 -bottom-[3px] h-[2px] bg-gradient-to-r from-[#f5b94a] to-transparent pointer-events-none" />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Partículas de animación ── */}
        {animation && particles.length > 0 && (isObs ? !isMuted : true) && (
          <div className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {particles.map((p) => {
              const style: React.CSSProperties = {
                position: 'absolute',
                top: '-40px',
                left: `${p.left}%`,
                fontSize: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                animationName: 'overlay-fall',
                animationTimingFunction: 'linear',
                animationFillMode: 'forwards',
                transform: `rotate(${p.rotation}deg)`,
              };

              if (animation === 'confetti') {
                return (
                  <div
                    key={p.id}
                    style={{
                      ...style,
                      width: `${p.size * 0.4}px`,
                      height: `${p.size * 0.8}px`,
                      backgroundColor: p.color,
                      borderRadius: '2px',
                    }}
                  />
                );
              }
              return (
                <div key={p.id} style={style}>
                  {p.char}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Keyframes de caída ── */}
        <style>{`
          @keyframes overlay-fall {
            0%   { top: -50px;  transform: translateY(0)     rotate(0deg);   }
            100% { top: 110%;   transform: translateY(110%)  rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
