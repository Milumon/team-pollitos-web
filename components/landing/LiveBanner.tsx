'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ExternalLink, Radio, Users } from 'lucide-react';

type StreamStatus = {
  is_live: boolean;
  tiktok_username: string;
  viewer_count: number;
  stream_title?: string | null;
};

export function LiveBanner() {
  const [status, setStatus] = useState<StreamStatus | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const { data } = await supabase
          .from('stream_status')
          .select('is_live, tiktok_username, viewer_count, stream_title')
          .eq('id', 1)
          .maybeSingle();

        if (mounted && data) {
          setStatus(data as StreamStatus);
        }
      } catch (err) {
        console.warn('Error loading stream status:', err);
      }
    }

    void loadStatus();

    // Subscribe to Realtime updates
    const channel = supabase
      .channel('landing-stream-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stream_status', filter: 'id=eq.1' },
        (payload) => {
          if (mounted && payload.new) {
            setStatus(payload.new as StreamStatus);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (!status || !status.is_live) {
    return null;
  }

  const tiktokUrl = `https://www.tiktok.com/@${status.tiktok_username || 'milumon_gaming'}/live`;

  return (
    <aside aria-label="Aviso de transmisión en vivo" className="w-full bg-linear-to-r from-red-600 via-rose-600 to-pink-600 text-white shadow-lg animate-in fade-in slide-in-from-top duration-300 relative z-40">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white font-black text-xs uppercase tracking-wider backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-white animate-ping mr-1" />
            <Radio className="w-3.5 h-3.5" /> EN VIVO
          </span>
          <span className="font-bold">
            {status.stream_title || '¡Milumon está en directo en TikTok!'}
          </span>
          {status.viewer_count > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-white/90 bg-black/20 px-2 py-0.5 rounded-full">
              <Users className="w-3 h-3" /> {status.viewer_count} espectadores
            </span>
          )}
        </div>

        <a
          href={tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-white text-rose-700 hover:bg-neutral-100 font-black text-xs uppercase tracking-wider shadow-sm transition hover:scale-105"
        >
          Ver en TikTok <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </aside>
  );
}