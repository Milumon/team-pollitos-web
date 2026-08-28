'use client';

import React from 'react';
import Image from 'next/image';
import type { OverlayEvent } from '@/components/OverlayCanvas';

type NotificationPopupProps = {
  event: OverlayEvent;
  avatarSize?: number;
  contentSize?: number;
  senderSize?: number;
  senderLabel?: string;
  className?: string;
};

export function NotificationPopup({
  event,
  avatarSize = 32,
  contentSize = 14,
  senderSize = 11,
  senderLabel,
  className = '',
}: NotificationPopupProps) {
  const sender = senderLabel ?? event.sender_roblox_user ?? 'VIP';

  const contentLabel =
    event.type === 'tts'
      ? `"${event.content}"`
      : event.type === 'sound'
      ? `Sonido: ${event.content}`
      : event.type === 'voice'
      ? 'Audio de voz'
      : event.type === 'image_audio'
      ? `Imagen: ${event.content}`
      : event.type === 'video'
      ? `Video: ${event.content}`
      : event.type === 'audio'
      ? `Audio: ${event.content}`
      : `Animación: ${event.content ?? ''}`;

  const typeLabel =
    event.type === 'tts' ? 'mensaje' : event.type === 'sound' ? 'sonido' : event.type === 'voice' ? 'audio' : event.type === 'image_audio' ? 'imagen' : event.type === 'video' ? 'video' : event.type === 'audio' ? 'audio' : 'evento';

  return (
    <div
      className={[
        'relative bg-[#15100a]/92 border border-[#e8a33d]/70 p-3',
        'flex items-start gap-2.5 z-30',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* corner brackets */}
      <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-[#f5b94a] pointer-events-none" />
      <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-[#f5b94a] pointer-events-none" />
      <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-[#f5b94a] pointer-events-none" />
      <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-[#f5b94a] pointer-events-none" />

      {/* live indicator */}
      <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#f5b94a] animate-pulse pointer-events-none" />

      {event.sender_avatar_url ? (
        <div
          style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
          className="border border-[#e8a33d]/70 overflow-hidden shrink-0 mt-1.5"
        >
          <Image
            src={event.sender_avatar_url}
            alt={sender}
            width={avatarSize}
            height={avatarSize}
            unoptimized
            className="w-full h-full object-cover"
            style={{ transform: 'scale(1.6) translateY(-8%)', transformOrigin: 'center top', objectPosition: 'center top' }}
          />
        </div>
      ) : (
        <div
          style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
          className="bg-[#241a10] border border-[#e8a33d]/70 flex items-center justify-center text-lg shrink-0 mt-1.5"
        >
          {event.type === 'sound' ? '🔊' : '🗣️'}
        </div>
      )}

      <div className="min-w-0 text-left flex-1 pt-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f5b94a] mb-1 leading-none">
          &gt;&gt;&gt; {typeLabel}
        </p>
        <p
          style={{ fontSize: `${contentSize}px` }}
          className={`font-black text-[#f4ead9] leading-tight ${
            event.type === 'tts' ? 'line-clamp-3' : 'truncate'
          }`}
        >
          {contentLabel}
        </p>
        <p
          style={{ fontSize: `${senderSize}px` }}
          className="font-bold text-[#c99a5b] truncate mt-1"
        >
          Por: @{sender}
        </p>
      </div>

      {/* bottom filete */}
      <span className="absolute left-2 right-2 -bottom-[3px] h-[2px] bg-gradient-to-r from-[#f5b94a] to-transparent pointer-events-none" />
    </div>
  );
}
