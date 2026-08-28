'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabaseClient';

type StreamComment = {
  id: string;
  tiktok_user: string;
  nickname: string;
  message: string;
  team_member_level: number;
  is_follower: boolean;
  is_subscriber: boolean;
  is_moderator: boolean;
  badges?: unknown[];
  created_at: string;
};

type ChatSettings = {
  followers_only: boolean;
  subscribers_only: boolean;
  moderators_only: boolean;
  min_team_member_level: number;
  emoji_filter: string | null;
  chat_position_x: number;
  chat_position_y: number;
  chat_width: number;
  chat_max_messages: number;
  chat_font_size: number;
  chat_opacity: number;
  chat_direction: 'bottom-up' | 'top-down';
  chat_theme: 'glassmorphism' | 'solid' | 'minimal' | 'neon';
  show_badges: boolean;
  is_enabled: boolean;
};

const DEFAULT_SETTINGS: ChatSettings = {
  followers_only: false,
  subscribers_only: false,
  moderators_only: false,
  min_team_member_level: 0,
  emoji_filter: null,
  chat_position_x: 20,
  chat_position_y: 400,
  chat_width: 380,
  chat_max_messages: 6,
  chat_font_size: 15,
  chat_opacity: 0.88,
  chat_direction: 'bottom-up',
  chat_theme: 'glassmorphism',
  show_badges: true,
  is_enabled: true,
};

const CANVAS_W = 720;
const CANVAS_H = 1280;

const DEFAULT_SAMPLE_COMMENTS: StreamComment[] = [
  {
    id: 'sample-1',
    tiktok_user: 'milumon_fan',
    nickname: 'Pollito VIP 💎',
    message: '¡Hola a todos en el directo! 🐣🔥',
    team_member_level: 12,
    is_follower: true,
    is_subscriber: true,
    is_moderator: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    tiktok_user: 'gamer_pro',
    nickname: 'GamerPro 🎮',
    message: '¡Que buena partida en Minecraft! 👏',
    team_member_level: 5,
    is_follower: true,
    is_subscriber: false,
    is_moderator: false,
    created_at: new Date().toISOString(),
  },
];

export default function ChatOverlayPage() {
  const [comments, setComments] = useState<StreamComment[]>([]);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [canvasFitScale, setCanvasFitScale] = useState(1);
  const aspectContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => ''
  );
  const params = new URLSearchParams(search);
  const isDebug = params.get('debug') === 'true';
  const showPreview = params.get('preview') === 'true';

  // 1. ResizeObserver for true 9:16 aspect scaling (matching main overlay)
  useEffect(() => {
    const el = aspectContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCanvasFitScale(Math.min(height / CANVAS_H, width / CANVAS_W, 1));
    });
    observer.observe(el);
    const { clientWidth: w, clientHeight: h } = el;
    if (w > 0 && h > 0) {
      setCanvasFitScale(Math.min(h / CANVAS_H, w / CANVAS_W, 1));
    }
    return () => observer.disconnect();
  }, []);

  // 2. Load initial data & Realtime subscriptions
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const { data: setts } = await supabase
          .from('stream_chat_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (mounted && setts) {
          setSettings(setts as ChatSettings);
        }

        const max = setts?.chat_max_messages || 6;
        const { data: initialComments } = await supabase
          .from('stream_comments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(max);

        if (mounted) {
          if (initialComments && initialComments.length > 0) {
            setComments((initialComments as StreamComment[]).reverse());
          } else {
            // If DB has no comments yet, show sample comments so user sees overlay is active
            setComments(DEFAULT_SAMPLE_COMMENTS);
          }
        }
      } catch (err) {
        console.error('Error loading chat overlay data:', err);
        if (mounted) setComments(DEFAULT_SAMPLE_COMMENTS);
      }
    }

    void loadData();

    // Subscribe to Realtime comments
    const commentsChannel = supabase
      .channel('overlay-chat-realtime-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_comments' },
        (payload) => {
          const newComment = payload.new as StreamComment;
          setComments((prev) => {
            // Remove samples if real comments start flowing
            const filtered = prev.filter((c) => !c.id.startsWith('sample-'));
            const next = [...filtered, newComment];
            return next.slice(-(settings.chat_max_messages || 8));
          });
        }
      )
      .subscribe((status) => {
        console.log('[Chat Overlay] Realtime status:', status);
      });

    // Subscribe to Realtime settings
    const settingsChannel = supabase
      .channel('overlay-chat-settings-realtime-v2')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stream_chat_settings', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new as ChatSettings);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(commentsChannel);
      void supabase.removeChannel(settingsChannel);
    };
  }, [settings.chat_max_messages]);

  // 3. Auto-scroll chat container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [comments]);

  if (!settings.is_enabled && !isDebug && !showPreview) {
    return <div className="w-screen h-screen bg-transparent pointer-events-none" />;
  }

  // Filter messages based on settings
  const filteredComments = comments.filter((c) => {
    if (settings.moderators_only && !c.is_moderator) return false;
    if (settings.subscribers_only && !c.is_subscriber) return false;
    if (settings.followers_only && !c.is_follower) return false;
    if (settings.min_team_member_level > 0 && c.team_member_level < settings.min_team_member_level) return false;
    return true;
  });

  const getThemeClass = () => {
    switch (settings.chat_theme) {
      case 'solid':
        return 'bg-[#1e1f22] border border-neutral-700 text-white shadow-2xl';
      case 'neon':
        return 'bg-black/90 border-2 border-[#FFC200] shadow-[0_0_20px_rgba(255,194,0,0.4)] text-yellow-100';
      case 'minimal':
        return 'bg-black/60 text-white backdrop-blur-sm border-l-4 border-[#FFC200]';
      case 'glassmorphism':
      default:
        return 'bg-neutral-950/80 backdrop-blur-md border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white';
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent select-none pointer-events-none font-sans flex items-center justify-center">
      
      {/* 9:16 Aspect Container matching OBS canvas exactly */}
      <div
        ref={aspectContainerRef}
        className={`relative aspect-[9/16] h-full overflow-hidden ${
          isDebug ? 'outline outline-4 outline-dashed outline-[#FFC200]/60 bg-black/20' : ''
        }`}
        style={{ background: 'transparent' }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${canvasFitScale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Chat Container Box placed at exact (X, Y) */}
          <div
            ref={containerRef}
            style={{
              position: 'absolute',
              left: `${settings.chat_position_x}px`,
              top: `${settings.chat_position_y}px`,
              width: `${settings.chat_width}px`,
              opacity: settings.chat_opacity,
              fontSize: `${settings.chat_font_size}px`,
            }}
            className={`flex flex-col gap-2.5 transition-all duration-300 pointer-events-auto ${
              settings.chat_direction === 'bottom-up' ? 'justify-end' : 'justify-start'
            }`}
          >
            {filteredComments.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${getThemeClass()}`}
              >
                {/* Header: Badges + Nickname */}
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {settings.show_badges && (
                    <div className="flex items-center gap-1 text-[0.8em]">
                      {item.is_moderator && (
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-500/30 text-blue-300 font-bold border border-blue-400/40">
                          🛡️ MOD
                        </span>
                      )}
                      {item.is_subscriber && (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-500/30 text-purple-300 font-bold border border-purple-400/40">
                          ⭐ SUB
                        </span>
                      )}
                      {item.team_member_level > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-400/30 text-amber-300 font-bold border border-amber-400/40">
                          🐣 Lv.{item.team_member_level}
                        </span>
                      )}
                    </div>
                  )}

                  <span className="font-display font-bold text-[#FFC200] drop-shadow-sm tracking-wide">
                    {item.nickname}
                  </span>
                  <span className="text-white/40 text-[0.75em] font-mono">
                    @{item.tiktok_user}
                  </span>
                </div>

                {/* Message Body */}
                <div className="leading-snug break-words font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {item.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        html, body {
          background: transparent !important;
          background-color: transparent !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
      `}</style>
    </div>
  );
}
