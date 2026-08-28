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
  chat_max_messages: 8,
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

  // Force transparent background for OBS browser source
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

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

        const max = setts?.chat_max_messages || 8;
        const { data: initialComments } = await supabase
          .from('stream_comments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(max);

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
      .channel('overlay-comments-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_comments' },
        (payload) => {
          const newComment = payload.new as StreamComment;
          setComments((prev) => {
            const next = [...prev, newComment];
            return next.slice(-(settings.chat_max_messages || 8));
          });
        }
      )
      .subscribe();

    // Subscribe to Realtime settings changes
    const settingsChannel = supabase
      .channel('overlay-chat-settings-realtime')
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

  // Filter messages
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
        return 'bg-neutral-900 border border-neutral-700 text-white shadow-2xl';
      case 'neon':
        return 'bg-black/90 border-2 border-[#FFC200] shadow-[0_0_20px_rgba(255,194,0,0.35)] text-yellow-100';
      case 'minimal':
        return 'bg-black/50 text-white backdrop-blur-sm border-l-4 border-[#FFC200]';
      case 'glassmorphism':
      default:
        return 'bg-neutral-950/80 backdrop-blur-md border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white';
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
        {filteredComments.map((item) => (
          <div
            key={item.id}
            className={`p-3 rounded-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${getThemeClass()}`}
          >
            {/* Header: Badges + Nickname */}
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {settings.show_badges && (
                <div className="flex items-center gap-1 text-[0.8em]">
                  {item.is_moderator && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-bold border border-blue-400/40">
                      🛡️ MOD
                    </span>
                  )}
                  {item.is_subscriber && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 font-bold border border-purple-400/40">
                      ⭐ SUB
                    </span>
                  )}
                  {item.team_member_level > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400/30 text-amber-300 font-bold border border-amber-400/40">
                      🐣 Lv.{item.team_member_level}
                    </span>
                  )}
                </div>
              )}

              <span className="font-bold text-[#FFC200] drop-shadow-sm tracking-wide">
                {item.nickname}
              </span>
              <span className="text-white/40 text-[0.75em]">
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
  );
}
