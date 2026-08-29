function formatNickname(name: string): string {
  if (!name) return 'Pollito Fan 🐣';
  const trimmed = name.trim();
  if (trimmed.startsWith('MS4w') || (trimmed.length > 26 && !trimmed.includes(' '))) {
    return 'Pollito Fan 🐣';
  }
  return trimmed;
}

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
    tiktok_user: 'pollito_vip',
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

  const settingsRef = useRef<ChatSettings>(settings);
  settingsRef.current = settings;

  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => ''
  );
  const params = new URLSearchParams(search);
  const isDebug = params.get('debug') === 'true';
  const showPreview = params.get('preview') === 'true';

  // 1. ResizeObserver for true 9:16 aspect scaling (720x1280 base)
  useEffect(() => {
    const el = aspectContainerRef.current;
    if (!el) return;

    const updateScale = () => {
      const parent = el.parentElement || document.documentElement;
      const vw = parent.clientWidth || window.innerWidth;
      const vh = parent.clientHeight || window.innerHeight;

      const scaleW = vw / CANVAS_W;
      const scaleH = vh / CANVAS_H;
      const fit = Math.min(scaleW, scaleH);
      setCanvasFitScale(fit > 0 ? fit : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el.parentElement || document.body);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  // 2. Load initial data & Realtime subscriptions + Polling Fallback
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

        const max = setts?.chat_max_messages || 8;
        // Only fetch comments from current stream session (last 2 hours)
        const recentThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: initialComments } = await supabase
          .from('stream_comments')
          .select('*')
          .gte('created_at', recentThreshold)
          .order('created_at', { ascending: false })
          .limit(max);

        if (mounted) {
          if (initialComments && initialComments.length > 0) {
            setComments((initialComments as StreamComment[]).reverse());
          } else if (showPreview) {
            setComments(DEFAULT_SAMPLE_COMMENTS);
          } else {
            setComments([]);
          }
        }
      } catch (err) {
        console.error('Error loading chat overlay data:', err);
        if (mounted && showPreview) {
          setComments(DEFAULT_SAMPLE_COMMENTS);
        }
      }
    }

    void loadData();

    // Subscribe to Realtime comments
    const commentsChannel = supabase
      .channel('overlay-chat-realtime-live-v4')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_comments' },
        (payload) => {
          const newComment = payload.new as StreamComment;
          setComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev;
            const filtered = prev.filter((c) => !c.id.startsWith('sample-'));
            const max = settingsRef.current.chat_max_messages || 8;
            return [...filtered, newComment].slice(-max);
          });
        }
      )
      .subscribe();

    // Subscribe to Realtime settings
    const settingsChannel = supabase
      .channel('overlay-chat-settings-live-v4')
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

    // Fallback sync every 2.5s in case OBS webview throttles websocket
    const pollInterval = setInterval(async () => {
      if (!mounted) return;
      try {
        const max = settingsRef.current.chat_max_messages || 8;
        const recentThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: latest } = await supabase
          .from('stream_comments')
          .select('*')
          .gte('created_at', recentThreshold)
          .order('created_at', { ascending: false })
          .limit(max);

        if (mounted && latest && latest.length > 0) {
          const reversed = (latest as StreamComment[]).reverse();
          setComments((prev) => {
            const hasNew = reversed.some((r) => !prev.some((p) => p.id === r.id));
            if (hasNew || prev.some((p) => p.id.startsWith('sample-'))) {
              return reversed;
            }
            return prev;
          });
        }
      } catch {}
    }, 2500);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      void supabase.removeChannel(commentsChannel);
      void supabase.removeChannel(settingsChannel);
    };
  }, [showPreview]);

  // 3. Auto-scroll chat container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [comments]);

  if (!settings.is_enabled) {
    return null;
  }

  // Filter comments based on dynamic stream settings
  const filteredComments = comments.filter((c) => {
    if (c.id.startsWith('sample-')) return showPreview;
    if (settings.moderators_only && !c.is_moderator) return false;
    if (settings.subscribers_only && !c.is_subscriber) return false;
    if (settings.followers_only && !c.is_follower) return false;
    if (settings.min_team_member_level > 0 && c.team_member_level < settings.min_team_member_level) return false;
    return true;
  });

  const visibleComments = filteredComments.slice(-settings.chat_max_messages);
  const orderedComments =
    settings.chat_direction === 'bottom-up' ? [...visibleComments].reverse() : visibleComments;

  const getThemeStyle = () => {
    switch (settings.chat_theme) {
      case 'solid':
        return {
          backgroundColor: `rgba(15, 17, 20, ${settings.chat_opacity})`,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        };
      case 'neon':
        return {
          backgroundColor: `rgba(10, 10, 15, ${settings.chat_opacity})`,
          border: '2px solid #FFC200',
          boxShadow: '0 0 16px rgba(255, 194, 0, 0.45)',
          color: '#fffef0',
        };
      case 'minimal':
        return {
          backgroundColor: `rgba(0, 0, 0, ${settings.chat_opacity * 0.7})`,
          borderLeft: '4px solid #FFC200',
          color: '#ffffff',
        };
      case 'glassmorphism':
      default:
        return {
          backgroundColor: `rgba(18, 20, 24, ${settings.chat_opacity})`,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          color: '#ffffff',
        };
    }
  };

  return (
    <div
      ref={aspectContainerRef}
      className="fixed inset-0 overflow-hidden flex items-center justify-center pointer-events-none select-none"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Native 720×1280 OBS Virtual Canvas Container */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          width: `${CANVAS_W}px`,
          height: `${CANVAS_H}px`,
          transform: `scale(${canvasFitScale})`,
          transformOrigin: 'center center',
          backgroundColor: 'transparent',
        }}
      >
        {/* Debug Grid */}
        {isDebug && (
          <div className="absolute inset-0 border-2 border-dashed border-red-500/40 pointer-events-none flex flex-col justify-between p-3 text-red-400 font-mono text-xs">
            <span>OBS Overlay Chat 720×1280 (Scale: {canvasFitScale.toFixed(2)})</span>
            <span>Mensajes: {orderedComments.length}</span>
          </div>
        )}

        {/* Dynamic Chat Overlay Box (Only renders if comments exist or in preview) */}
        {orderedComments.length > 0 && (
          <div
            ref={containerRef}
            className="absolute transition-all duration-200 overflow-hidden rounded-2xl flex flex-col pointer-events-none"
            style={{
              left: `${settings.chat_position_x}px`,
              top: `${settings.chat_position_y}px`,
              width: `${settings.chat_width}px`,
              maxHeight: '600px',
              fontSize: `${settings.chat_font_size}px`,
              ...getThemeStyle(),
            }}
          >
            <div className="p-3.5 space-y-2.5 overflow-y-auto custom-scrollbar flex flex-col">
              {orderedComments.map((comment) => (
                <div
                  key={comment.id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-0.5 leading-snug"
                >
                  {/* Header: Badges & Name */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {settings.show_badges && (
                      <>
                        {comment.is_moderator && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black uppercase">
                            MOD
                          </span>
                        )}
                        {comment.is_subscriber && (
                          <span className="px-1.5 py-0.5 bg-[#FFC200]/20 text-[#FFC200] border border-[#FFC200]/30 rounded text-[9px] font-black uppercase">
                            SUB
                          </span>
                        )}
                        {comment.team_member_level > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] font-black">
                            Nv.{comment.team_member_level}
                          </span>
                        )}
                      </>
                    )}

                    <span className="font-display font-black text-[#FFC200] tracking-wide text-xs">
                      {formatNickname(comment.nickname)}
                    </span>
                  </div>

                  {/* Body Message */}
                  <p className="font-sans font-medium text-white/95 break-words drop-shadow-sm">
                    {comment.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
