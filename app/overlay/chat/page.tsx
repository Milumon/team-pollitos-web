'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  chat_position_x: 20,
  chat_position_y: 400,
  chat_width: 380,
  chat_max_messages: 12,
  chat_font_size: 15,
  chat_opacity: 0.88,
  chat_direction: 'bottom-up',
  chat_theme: 'glassmorphism',
  show_badges: true,
  is_enabled: true,
};

export default function ChatOverlayPage() {
  const [comments, setComments] = useState<StreamComment[]>([]);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial settings & comments
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

        const { data: initialComments } = await supabase
          .from('stream_comments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(setts?.chat_max_messages || 12);

        if (mounted && initialComments) {
          setComments((initialComments as StreamComment[]).reverse());
        }
      } catch (err) {
        console.error('Error loading chat overlay data:', err);
      }
    }

    void loadData();

    // Subscribe to Realtime comments
    const commentsChannel = supabase
      .channel('overlay-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_comments' },
        (payload) => {
          const newComment = payload.new as StreamComment;
          setComments((prev) => {
            const next = [...prev, newComment];
            return next.slice(-(settings.chat_max_messages || 15));
          });
        }
      )
      .subscribe();

    // Subscribe to Realtime settings changes
    const settingsChannel = supabase
      .channel('overlay-chat-settings')
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

  // Auto scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [comments]);

  if (!settings.is_enabled) {
    return <div className="w-screen h-screen bg-transparent pointer-events-none" />;
  }

  const getThemeClass = () => {
    switch (settings.chat_theme) {
      case 'solid':
        return 'bg-neutral-900 border border-neutral-700 text-white shadow-xl';
      case 'neon':
        return 'bg-black/90 border border-yellow-400/60 shadow-[0_0_15px_rgba(250,204,21,0.25)] text-yellow-100';
      case 'minimal':
        return 'bg-black/40 text-white backdrop-blur-xs border-l-2 border-yellow-400';
      case 'glassmorphism':
      default:
        return 'bg-neutral-950/75 backdrop-blur-md border border-white/10 shadow-2xl text-white';
    }
  };

  return (
    <div className="w-screen h-screen bg-transparent overflow-hidden select-none pointer-events-none relative font-sans">
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
        className={`flex flex-col gap-2 transition-all duration-300 ${
          settings.chat_direction === 'bottom-up' ? 'justify-end' : 'justify-start'
        }`}
      >
        {comments.map((item) => (
          <div
            key={item.id}
            className={`p-2.5 rounded-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${getThemeClass()}`}
          >
            {/* Header: Badges + Nickname */}
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {settings.show_badges && (
                <div className="flex items-center gap-1 text-[0.8em]">
                  {item.is_moderator && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      🛡️ MOD
                    </span>
                  )}
                  {item.is_subscriber && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                      ⭐ SUB
                    </span>
                  )}
                  {item.team_member_level > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-bold border border-yellow-500/40">
                      🐣 Lv.{item.team_member_level}
                    </span>
                  )}
                  {item.is_follower && !item.is_subscriber && item.team_member_level === 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-medium border border-sky-500/30">
                      ✓ Follower
                    </span>
                  )}
                </div>
              )}

              <span className="font-bold text-yellow-300 drop-shadow-sm tracking-wide">
                {item.nickname}
              </span>
              <span className="text-white/40 text-[0.75em]">
                @{item.tiktok_user}
              </span>
            </div>

            {/* Message Body */}
            <div className="leading-snug break-words text-white/95 font-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {item.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}