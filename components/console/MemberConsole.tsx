'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { Header } from '@/components/ui/Header';
import RobloxOnboarding from '@/components/RobloxOnboarding';
import {
  Volume2,
  Send,
  Sparkles,
  ShieldAlert,
  ArrowLeft,
  Loader2,
  List,
  User,
  LayoutDashboard,
  Settings,
  HelpCircle,
  Scissors,
  Trophy,
  Check,
  Ban,
} from 'lucide-react';
import { soundManager } from '@/lib/sound';
import { convertAudioToMp3 } from '@/lib/audioConverter';
import MemberEffectsPanel from '@/components/console/MemberEffectsPanel';
import MemberVoicePanel from '@/components/console/MemberVoicePanel';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { TikTokRankingConsole } from '@/components/tiktok-rankings/RankingViews';
import { TikTokRankingHistory } from '@/components/tiktok-rankings/HistoryViews';
import { MemberHomeView } from '@/components/console/routes/MemberHomeView';
import { MemberSoundsView } from '@/components/console/routes/MemberSoundsView';
import {
  MEMBER_DISPLAY_NAME_INPUT_PATTERN,
  MEMBER_DISPLAY_NAME_MAX_LENGTH,
  MEMBER_DISPLAY_NAME_MIN_LENGTH,
} from '@/lib/memberDisplayName';
const AudioPreview = dynamic(() => import('@/components/ui/AudioPreview'), { ssr: false });

type StoredRobloxProfile = {
  id: string;
  roblox_user_id: number | null;
  roblox_user: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_verified_at: string | null;
  tiktok_user?: string | null;
  link_status?: 'none' | 'pending' | 'approved' | 'rejected' | null;
  rejection_reason?: string | null;
  last_nickname_updated_at?: string | null;
  soundboard_disabled?: boolean;
  perm_upload_images?: boolean;
  perm_upload_videos?: boolean;
  perm_upload_audio?: boolean;
  perm_tts_text?: boolean;
  perm_tts_record?: boolean;
  perm_edit_nickname?: boolean;
  perm_trigger_sounds?: boolean;
  perm_trigger_media?: boolean;
  perm_trigger_animations?: boolean;
  perm_edit_sounds?: boolean;
};

type StreamEvent = {
  id: string;
  type: 'sound' | 'tts' | 'animation' | 'audio' | 'image' | 'image_audio' | 'video';
  content: string;
  sender_roblox_user: string | null;
  sender_tiktok_user: string | null;
  created_at: string;
};

type LeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  count: number;
};

type WeeklyLeaderboards = {
  usage: LeaderboardEntry[];
  sounds: LeaderboardEntry[];
  images: LeaderboardEntry[];
};

type StreamSettings = {
  id: number;
  is_muted: boolean;
  global_cooldown_seconds: number;
  personal_cooldown_seconds: number;
  overlay_media_repeat_count?: number;
};

interface PendingTrigger {
  type: 'sound' | 'tts' | 'animation' | 'image_audio' | 'video' | 'image' | 'audio';
  content: string;
  message: string;
  mediaUrls?: { image_url?: string; audio_url?: string; video_url?: string };
}


const ANIMATIONS = [
  { id: 'eggs', name: '🥚 Lluvia de Huevos', color: 'from-amber-200 to-yellow-300' },
  { id: 'sparkles', name: '✨ Destellos Brillantes', color: 'from-teal-100 to-cyan-300' },
  { id: 'confetti', name: '🎉 Lluvia de Confeti', color: 'from-pink-200 to-purple-300' },
];

const LEADERBOARD_SECTIONS = [
  { key: 'usage' as const, title: 'Más uso del panel', icon: '⚡', suffix: 'interacciones' },
  { key: 'sounds' as const, title: 'Más sonidos subidos', icon: '🔊', suffix: 'sonidos' },
  { key: 'images' as const, title: 'Más imágenes subidas', icon: '🖼️', suffix: 'imágenes' },
];

function LeaderboardGrid({ leaderboards, loading, emptyLabel }: { leaderboards: WeeklyLeaderboards; loading: boolean; emptyLabel: string }) {
  if (loading) {
    return <div className="py-12 text-center text-xs font-bold text-gray-500 uppercase animate-pulse">Cargando ranking...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {LEADERBOARD_SECTIONS.map((section) => {
        const entries = leaderboards[section.key];
        return (
          <section key={section.key} className="bg-[#24262b] border border-neutral-700/60 rounded-2xl p-3.5">
            <div className="flex items-center gap-2 border-b border-neutral-700/60 pb-2.5 mb-3">
              <span className="text-lg">{section.icon}</span>
              <h3 className="font-display font-bold text-xs text-white">{section.title}</h3>
            </div>

            {entries.length === 0 ? (
              <p className="text-[10px] text-gray-500 font-semibold py-5 text-center">{emptyLabel}</p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry, index) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${index === 0 ? 'bg-[#FFC200]/10 border border-[#FFC200]/50 shadow-[0_0_16px_rgba(255,194,0,.12)]' : 'bg-[#2b2d31] border border-neutral-700/40'}`}
                  >
                    <span className={`w-5 text-center font-black ${index === 0 ? 'text-[#FFC200] text-base' : 'text-gray-500 text-xs'}`}>
                      {index === 0 ? '👑' : `${index + 1}.`}
                    </span>
                    <div className={`relative ${index === 0 ? 'w-10 h-10 border-2 border-[#FFC200]' : 'w-7 h-7 border'} rounded-full overflow-hidden bg-[#35373d] shrink-0 flex items-center justify-center`}>
                      {entry.avatarUrl ? <Image src={entry.avatarUrl} alt={index === 0 ? `Avatar de ${entry.name}` : ''} fill sizes="40px" unoptimized className="w-full h-full object-cover" /> : <span className={index === 0 ? 'text-xl' : 'text-sm'}>🐣</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-bold ${index === 0 ? 'text-[#FFC200] text-xs' : 'text-white text-[11px]'}`}>@{entry.name}</p>
                      <p className="text-[9px] text-gray-500 font-semibold">{entry.count} {section.suffix}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

type ConsoleTab = 'sounds' | 'tts' | 'animations' | 'feed' | 'dashboard' | 'rankings' | 'nickname' | 'settings' | 'help';
type SoundType = 'audios' | 'multimedia' | 'videos';

const PANEL_TABS = [
  { id: 'dashboard' as const, label: 'Inicio', icon: LayoutDashboard, href: '/panel/inicio' },
  { id: 'sounds' as const, label: 'Sonidos', icon: Volume2, href: '/panel/sonidos' },
  { id: 'tts' as const, label: 'Voz', icon: Send, href: '/panel/voz?modo=texto' },
  { id: 'animations' as const, label: 'Efectos', icon: Sparkles, href: '/panel/efectos' },
  { id: 'rankings' as const, label: 'Ranking', icon: Trophy, href: '/panel/clasificaciones' },
  { id: 'feed' as const, label: 'Feed', icon: List, href: '/panel/feed' },
  { id: 'nickname' as const, label: 'Nick', icon: User, href: '/panel/perfil' },
  { id: 'settings' as const, label: 'Ajustes', icon: Settings, href: '/panel/ajustes' },
  { id: 'help' as const, label: 'Ayuda', icon: HelpCircle, href: '/panel/ayuda' },
];

export default function MemberConsole({
  panelMode = false,
}: Readonly<{ children?: React.ReactNode; panelMode?: boolean }>) {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StoredRobloxProfile | null>(null);
  const [recentEvents, setRecentEvents] = useState<StreamEvent[]>([]);
  const [weeklyLeaderboards, setWeeklyLeaderboards] = useState<WeeklyLeaderboards>({ usage: [], sounds: [], images: [] });
  const [allTimeLeaderboards, setAllTimeLeaderboards] = useState<WeeklyLeaderboards>({ usage: [], sounds: [], images: [] });
  const [loadingLeaderboards, setLoadingLeaderboards] = useState(true);

  const [isRobloxOnboardingOpen, setIsRobloxOnboardingOpen] = useState(false);

  // TTS State
  const [ttsText, setTtsText] = useState('');
  const [sendingTts, setSendingTts] = useState(false);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordStartTimeRef = useRef<number>(0);

  // Sound/Animation Trigger State
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [pendingTrigger, setPendingTrigger] = useState<PendingTrigger | null>(null);
  const [customImageMessage, setCustomImageMessage] = useState('');
  const customImageMessageRef = useRef('');
  useEffect(() => { customImageMessageRef.current = customImageMessage; }, [customImageMessage]);
  const [sendMessageEnabled, setSendMessageEnabled] = useState(false);
  const sendMessageEnabledRef = useRef(false);
  useEffect(() => { sendMessageEnabledRef.current = sendMessageEnabled; }, [sendMessageEnabled]);
  const [sendRepeatEnabled, setSendRepeatEnabled] = useState(false);
  const sendRepeatEnabledRef = useRef(false);
  useEffect(() => { sendRepeatEnabledRef.current = sendRepeatEnabled; }, [sendRepeatEnabled]);

  // Dynamic Sounds Board
  const [sounds, setSounds] = useState<{ id: string; name: string; url?: string; cooldown_seconds?: number; is_public?: boolean; owner_user_id?: string | null; media_type?: string; image_url?: string; audio_url?: string; video_url?: string; trim_start?: number | null; trim_end?: number | null; profiles?: { roblox_user: string | null; roblox_display_name: string | null; roblox_avatar_url: string | null } | null }[]>([]);
  const [soundDurations, setSoundDurations] = useState<Record<string, number>>({});
  const [editingSound, setEditingSound] = useState<{ id: string; name: string; url: string; is_public: boolean; cooldown_seconds: number; media_type?: string; image_url?: string; video_url?: string; audio_url?: string; trim_start?: number | null; trim_end?: number | null } | null>(null);
  const [editSoundName, setEditSoundName] = useState('');
  const [editSoundCooldown, setEditSoundCooldown] = useState('0');
  const [editSoundPublic, setEditSoundPublic] = useState(true);
  const [savingSoundEdit, setSavingSoundEdit] = useState(false);
  const [loadingSounds, setLoadingSounds] = useState(true);

  // Sound edit — audio editing states
  const [editingSoundAudioEnabled, setEditingSoundAudioEnabled] = useState(false);
  const [editingSoundAudioFile, setEditingSoundAudioFile] = useState<File | null>(null);
  const [editingSoundAudioTrim, setEditingSoundAudioTrim] = useState<{ start: number; end: number } | null>(null);
  const [editingSoundAudioLoading, setEditingSoundAudioLoading] = useState(false);
  const [editingSoundAudioError, setEditingSoundAudioError] = useState('');
  const [editingSource, setEditingSource] = useState<'soundboard' | 'submission'>('soundboard');

  // Video trim state for edit modal
  const [editVideoTrimStart, setEditVideoTrimStart] = useState(0);
  const [editVideoTrimEnd, setEditVideoTrimEnd] = useState(0);
  const [editVideoDuration, setEditVideoDuration] = useState(0);

  // Media state
  const [, setMediaApproved] = useState<{ id: string; name: string; media_type: string; image_url?: string; audio_url?: string; video_url?: string; is_public?: boolean; owner_user_id?: string | null; cooldown_seconds?: number; profiles?: { roblox_user: string | null; roblox_display_name: string | null; roblox_avatar_url: string | null } | null }[]>([]);
  const [, setMediaSubmissions] = useState<{ id: string; media_type: string; name: string; image_url: string | null; audio_url: string | null; video_url: string | null; is_public: boolean; status: string; rejection_reason: string | null; suggested_cooldown_seconds: number; created_at: string }[]>([]);
  const [, setLoadingMedia] = useState(true);
  const [, setLoadingMediaSubs] = useState(false);

  // Stream Settings State
  const [streamSettings, setStreamSettings] = useState<StreamSettings | null>(null);

  // Cooldowns State
  const [soundCooldown, setSoundCooldown] = useState(0);
  const [ttsCooldown, setTtsCooldown] = useState(0);
  const [animationCooldown, setAnimationCooldown] = useState(0);

  // Local test mode (Probar sonido)
  const [isLocalTestMode, setIsLocalTestMode] = useState(false);

  // Local test overlay
  const [localTestOverlay, setLocalTestOverlay] = useState<{
    type: 'image' | 'image_audio' | 'video' | 'audio';
    name: string;
    image_url?: string;
    audio_url?: string;
    video_url?: string;
    trim_start?: number | null;
    trim_end?: number | null;
  } | null>(null);
  const localTestAudioRef = useRef<HTMLAudioElement | null>(null);
  const localTestVideoRef = useRef<HTMLVideoElement | null>(null);

  // Stream stats
  const [totalMembers, setTotalMembers] = useState(54);
  const [soundsToday, setSoundsToday] = useState(312);
  const [, setViewers] = useState(1248);
  const [, setUptimeSeconds] = useState(10113); // ~2:48:33

  // Nickname State
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [submittingNickname, setSubmittingNickname] = useState(false);
  const [, setIsBotAccount] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Error/Success state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // My Audios — submissions & private sounds
  type MySubmission = {
    id: string; name: string; url: string; file_path: string; is_public: boolean;
    suggested_cooldown_seconds: number;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason: string | null; created_at: string;
  };
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [, setLoadingMySubmissions] = useState(false);
  const [, setMyPrivateSounds] = useState<{ id: string; name: string; url: string; cooldown_seconds?: number | null }[]>([]);
  const [, setLoadingMyPrivate] = useState(false);

  // Audio upload form
  const [audioSubmitStatus, setAudioSubmitStatus] = useState<string | null>(null);

  // Anti-spam confirmation toggle (for kids safety)
  const [confirmSpamGuard, setConfirmSpamGuard] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('confirmSpamGuard');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const routedTab =
    (pathname === '/panel/inicio'
      ? 'dashboard'
      : pathname === '/panel/feed'
        ? 'feed'
        : pathname === '/panel/voz'
          ? 'tts'
          : pathname === '/panel/efectos'
            ? 'animations'
            : pathname === '/panel/sonidos'
              ? 'sounds'
              : pathname === '/panel/clasificaciones'
                ? 'rankings'
                : pathname === '/panel/perfil'
                  ? 'nickname'
                  : pathname === '/panel/ajustes'
                    ? 'settings'
                    : pathname === '/panel/ayuda'
                      ? 'help'
                      : 'sounds') as ConsoleTab;
  const requestedSoundType = searchParams?.get('tipo');
  const routedSoundType: SoundType =
    requestedSoundType === 'multimedia' || requestedSoundType === 'videos'
      ? requestedSoundType
      : 'audios';
  const displayedTab: ConsoleTab = routedTab;
  const displayedSoundType = routedSoundType;
  const routedTtsMode = searchParams?.get('modo') === 'grabacion' ? 'voice' : 'text';
  const displayedTtsMode = routedTtsMode;


  const warnedRealtimeRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const fetchSoundsRef = useRef<() => Promise<void>>(async () => {});

  // 1. Fetch Profile
  const fetchProfile = useCallback(async (currentSession: Session) => {
    try {
      const response = await fetch('/api/profile/verify-roblox', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });
      const data = await response.json();
      if (data.profile) {
        setProfile(data.profile);
        setIsBotAccount(!!data.isBotAccount);

        // Auto-disparar onboarding si no tiene nickname personalizado y no es la cuenta del bot
        const hasEmojis = !!(data.profile.roblox_display_name?.startsWith('🐣') && data.profile.roblox_display_name?.endsWith('🐣'));
        if (data.profile.link_status === 'approved' && !hasEmojis && !data.isBotAccount) {
          setIsNicknameModalOpen(true);
          const cleanName = (data.profile.roblox_display_name || '').replace(/🐣/g, '').trim();
          setNewNickname(cleanName);
        }
      }

      // Fetch admin status
      try {
        const statusRes = await fetch('/api/interviews/my-status', {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIsAdmin(!!statusData.is_admin);
        }
      } catch {}
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  }, []);

  // Helper to check if nickname contains emojis 🐣
  const isCustomNickname = (displayName: string | null) => {
    return !!(displayName?.startsWith('🐣') && displayName?.endsWith('🐣'));
  };

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (profile && (profile as Record<string, unknown>).perm_edit_nickname === false) {
      setNicknameError('No tenés permiso para cambiar tu apodo.');
      return;
    }
    setNicknameError(null);
    setSubmittingNickname(true);

    try {
      const response = await fetch('/api/profile/nickname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ nickname: newNickname }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar el nickname.');
      }

      setSuccess('¡Tu nickname y tag en Roblox fueron actualizados con éxito! 🐣');
      setTimeout(() => setSuccess(null), 5000);
      if (data.profile) {
        setProfile(data.profile);
      }
      setIsNicknameModalOpen(false);
      setNicknameError(null);
      soundManager.playHatch();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al actualizar el nickname.';
      setNicknameError(errMsg);
    } finally {
      setSubmittingNickname(false);
    }
  };

  // 2. Fetch Recent Events
  const fetchRecentEvents = useCallback(async (currentSession: Session) => {
    try {
      const response = await fetch('/api/stream/events', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const data = await response.json();
      if (data.events) {
        setRecentEvents(data.events);
      }
    } catch (err) {
      console.error('Error fetching recent events:', err);
    }
  }, []);

  const fetchLeaderboards = useCallback(async (currentSession: Session) => {
    try {
      const response = await fetch('/api/console/leaderboard', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setWeeklyLeaderboards({
          usage: data.weekly?.usage ?? [],
          sounds: data.weekly?.sounds ?? [],
          images: data.weekly?.images ?? [],
        });
        setAllTimeLeaderboards({
          usage: data.allTime?.usage ?? [],
          sounds: data.allTime?.sounds ?? [],
          images: data.allTime?.images ?? [],
        });
      }
    } catch (err) {
      console.error('Error fetching weekly leaderboards:', err);
    } finally {
      setLoadingLeaderboards(false);
    }
  }, []);

  const fetchStreamSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/stream/settings');
      if (response.ok) {
        const data = await response.json();
        setStreamSettings(data);
      }
    } catch (err) {
      console.error('Error fetching stream settings:', err);
    }
  }, []);

  // 3. Trigger Event Helper
  const triggerEvent = useCallback(async (type: 'sound' | 'tts' | 'animation' | 'image_audio' | 'video' | 'image' | 'audio', content: string, bypassConfirm = false, mediaUrls?: { image_url?: string; audio_url?: string; video_url?: string }, extraBody?: Record<string, string>) => {
    if (!session) return;
    setError(null);
    setSuccess(null);

    // Check if user is disabled from soundboard
    if (profile && (profile as Record<string, unknown>).soundboard_disabled) {
      setError('Tu acceso a la botonera fue deshabilitado por un administrador.');
      return;
    }

    // Check granular permissions
    if (profile) {
      const p = profile as Record<string, unknown>;
      if ((type === 'sound' || type === 'audio') && p.perm_trigger_sounds === false) {
        setError('No tenés permiso para activar sonidos.');
        return;
      }
      if ((type === 'image_audio' || type === 'video' || type === 'image') && p.perm_trigger_media === false) {
        setError('No tenés permiso para activar media.');
        return;
      }
      if (type === 'animation' && p.perm_trigger_animations === false) {
        setError('No tenés permiso para activar animaciones.');
        return;
      }
      if (type === 'tts' && p.perm_tts_text === false) {
        setError('No tenés permiso para usar TTS por texto.');
        return;
      }
    }

    // Anti-spam popup check
    if (!bypassConfirm && confirmSpamGuard && !isLocalTestMode) {
      const confirmMsg =
        type === 'sound' || type === 'audio'
          ? '¿Quieres reproducir este sonido en el stream?'
          : type === 'animation'
          ? '¿Quieres mostrar esta animación en pantalla?'
          : type === 'image_audio'
          ? '¿Quieres enviar esta imagen + audio al stream?'
          : type === 'video'
          ? '¿Quieres enviar este video al stream?'
          : type === 'image'
          ? '¿Quieres enviar esta imagen al stream?'
          : '¿Quieres enviar este mensaje de voz (TTS) al stream?';
      setPendingTrigger({
        type,
        content,
        message: confirmMsg,
        mediaUrls
      });
      return;
    }

    // Local checks before calling the API
    if ((type === 'sound' || type === 'audio' || type === 'image' || type === 'image_audio' || type === 'video') && soundCooldown > 0) {
      setError(`Esperá el cooldown de sonidos (${soundCooldown}s)`);
      return;
    }
    if (type === 'animation' && animationCooldown > 0) {
      setError(`Esperá el cooldown de animaciones (${animationCooldown}s)`);
      return;
    }
    if (type === 'tts' && ttsCooldown > 0) {
      setError(`Esperá el cooldown del TTS (${ttsCooldown}s)`);
      return;
    }

    if (type === 'sound' || type === 'audio' || type === 'image') setTriggeringId(content);
    if (type === 'animation') setTriggeringId(content);
    if (type === 'tts') setSendingTts(true);

    try {
      const response = await fetch('/api/stream/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type, content, ...mediaUrls, ...extraBody,
          ...(((type === 'image' || type === 'image_audio' || type === 'video') && customImageMessageRef.current.trim() && sendMessageEnabledRef.current) ? { message: customImageMessageRef.current.trim() } : {}),
          ...(((type === 'image' || type === 'image_audio') && sendRepeatEnabledRef.current) ? { repeat_enabled: true } : {})
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al disparar interacción');
      }

      setSuccess('¡Interacción enviada al stream en vivo! 🚀');
      setTimeout(() => setSuccess(null), 4000);
      soundManager.playPop();

      // Trigger local cooldowns
      if (type === 'sound' || type === 'audio' || type === 'image' || type === 'image_audio' || type === 'video') {
        const cd = Math.min(60, streamSettings?.personal_cooldown_seconds ?? 60);
        setSoundCooldown(cd);
      } else if (type === 'animation') {
        const cd = Math.min(60, streamSettings?.personal_cooldown_seconds ?? 60);
        setAnimationCooldown(cd);
      } else if (type === 'tts') {
        setTtsText('');
        const cd = streamSettings?.personal_cooldown_seconds ?? 300;
        setTtsCooldown(cd);
      }

      void fetchRecentEvents(session);
      void fetchLeaderboards(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
      setTimeout(() => setError(null), 6000);
    } finally {
      setTriggeringId(null);
      setSendingTts(false);
    }
  }, [session, profile, soundCooldown, ttsCooldown, animationCooldown, fetchRecentEvents, fetchLeaderboards, streamSettings, confirmSpamGuard, isLocalTestMode]);

  const handleConfirmTrigger = useCallback(async () => {
    if (!pendingTrigger) return;
    const { type, content, mediaUrls } = pendingTrigger;
    const extraFields: Record<string, string> = {};
    if (type === 'image' || type === 'image_audio' || type === 'video') {
      const trimmed = customImageMessage.trim();
      if (trimmed) extraFields.message = trimmed;
    }
    setPendingTrigger(null);
    setCustomImageMessage('');
    await triggerEvent(type, content, true, mediaUrls, extraFields);
  }, [pendingTrigger, triggerEvent, customImageMessage]);

  const fetchSounds = async () => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const response = await fetch('/api/admin/sounds', { headers });
      const data = await response.json();
      if (data.sounds) {
        setSounds(data.sounds);
        // Fetch durations for each sound
        const durations: Record<string, number> = {};
        await Promise.all(data.sounds.map(async (s: { id: string; url?: string }) => {
          if (!s.url) return;
          try {
            const audio = new Audio();
            audio.src = s.url;
            await new Promise<void>((resolve) => {
              audio.onloadedmetadata = () => { durations[s.id] = audio.duration; resolve(); };
              audio.onerror = () => resolve();
              setTimeout(() => resolve(), 3000);
            });
          } catch {}
        }));
        setSoundDurations(durations);
      }
    } catch (err) {
      console.error('Error fetching sounds:', err);
    } finally {
      setLoadingSounds(false);
    }
  };

  useEffect(() => { fetchSoundsRef.current = fetchSounds; });

  const loadMySubmissions = useCallback(async (currentSession: Session) => {
    setLoadingMySubmissions(true);
    try {
      const response = await fetch('/api/console/sounds/my-submissions', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const data = await response.json();
      if (data.submissions) setMySubmissions(data.submissions);
    } catch (err) {
      console.error('Error loading my submissions:', err);
    } finally {
      setLoadingMySubmissions(false);
    }
  }, []);

  const loadMyPrivateSounds = useCallback(async (currentSession: Session) => {
    setLoadingMyPrivate(true);
    try {
      const response = await fetch('/api/console/sounds/my-private', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const data = await response.json();
      if (data.sounds) setMyPrivateSounds(data.sounds);
    } catch (err) {
      console.error('Error loading private sounds:', err);
    } finally {
      setLoadingMyPrivate(false);
    }
  }, []);

  const handleSaveSound = async () => {
    if (!editingSound || !editSoundName.trim()) return;
    if (profile && (profile as Record<string, unknown>).perm_edit_sounds === false) {
      setError('No tenés permiso para editar sonidos.');
      return;
    }
    setSavingSoundEdit(true);
    setError(null);
    try {
      let res: Response;

      if (editingSoundAudioEnabled && editingSoundAudioFile && editingSoundAudioTrim) {
        // Has audio edits — process trim and send as FormData
        setAudioSubmitStatus('Procesando audio...');
        const processedFile = await convertAudioToMp3(
          editingSoundAudioFile,
          editingSoundAudioTrim.start,
          editingSoundAudioTrim.end
        );

        const formData = new FormData();
        formData.append('file', processedFile, processedFile.name);
        formData.append('name', editSoundName.trim());
        formData.append('cooldownSeconds', editSoundCooldown);
        formData.append('isPublic', String(editSoundPublic));

        res = await fetch(`/api/console/sounds/${editingSound.id}/edit`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        });
      } else {
        // Metadata only — send as JSON
        res = await fetch(`/api/console/sounds/${editingSound.id}/edit`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            name: editSoundName.trim(),
            cooldownSeconds: parseInt(editSoundCooldown) || 0,
            isPublic: editSoundPublic,
            ...(editingSound.media_type === 'video' ? {
              trimStart: editVideoTrimStart,
              trimEnd: editVideoTrimEnd,
            } : {}),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      // Update local state
      if (editingSource === 'soundboard') {
        setSounds(prev => prev.map(s => s.id === editingSound.id
          ? { ...s, name: editSoundName.trim(), is_public: editSoundPublic, cooldown_seconds: parseInt(editSoundCooldown) || 0, url: data.url || s.url, trim_start: editingSound.media_type === 'video' ? editVideoTrimStart : s.trim_start, trim_end: editingSound.media_type === 'video' ? editVideoTrimEnd : s.trim_end }
          : s
        ));
      } else {
        setMySubmissions(prev => prev.map(sub => sub.id === editingSound.id
          ? { ...sub, name: editSoundName.trim(), is_public: editSoundPublic, suggested_cooldown_seconds: parseInt(editSoundCooldown) || 0, url: data.url || sub.url }
          : sub
        ));
      }

      setEditingSound(null);
      setEditingSoundAudioEnabled(false);
      setEditingSoundAudioFile(null);
      setEditingSoundAudioTrim(null);
      setSuccess('Sonido actualizado ✓');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
      setTimeout(() => setError(null), 6000);
    } finally {
      setSavingSoundEdit(false);
      setAudioSubmitStatus(null);
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      // Obtener conteo de miembros aprobados reales
      const { count: membersCount, error: err1 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('link_status', 'approved');

      if (!err1 && membersCount !== null) {
        setTotalMembers(membersCount);
      }

      // Obtener conteo de eventos (sonidos, etc.) disparados hoy
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count: eventsCount, error: err2 } = await supabase
        .from('stream_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());

      if (!err2 && eventsCount !== null) {
        setSoundsToday(eventsCount);
      }
    } catch (e) {
      console.error('Error fetching stream stats:', e);
    }
  }, []);

  // Fetch approved media from soundboard
  const fetchMedia = useCallback(async () => {
    setLoadingMedia(true);
    try {
      const response = await fetch('/api/admin/sounds');
      const data = await response.json();
      if (data.sounds) {
        const mediaOnly = data.sounds.filter((s: Record<string, unknown>) => s.media_type === 'image_audio' || s.media_type === 'video');
        setMediaApproved(mediaOnly);
      }
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoadingMedia(false);
    }
  }, []);

  // Fetch user's media submissions
  const loadMediaSubmissions = useCallback(async (currentSession: Session) => {
    setLoadingMediaSubs(true);
    try {
      const response = await fetch('/api/console/media/my-submissions', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const data = await response.json();
      if (data.submissions) setMediaSubmissions(data.submissions);
    } catch (err) {
      console.error('Error loading media submissions:', err);
    } finally {
      setLoadingMediaSubs(false);
    }
  }, []);

  // INITIAL_SESSION is the single owner of client auth initialization. The
  // server layout independently enforces authorization without serializing tokens.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);

      if (!nextSession) {
        loadedUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      if (loadedUserIdRef.current !== nextSession.user.id) {
        loadedUserIdRef.current = nextSession.user.id;
        await fetchProfile(nextSession);
        await fetchRecentEvents(nextSession);
        await fetchLeaderboards(nextSession);
        await fetchSoundsRef.current();
        await fetchStreamSettings();
        await fetchStats();
        await loadMySubmissions(nextSession);
        await loadMyPrivateSounds(nextSession);
        await fetchMedia();
        await loadMediaSubmissions(nextSession);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchRecentEvents, fetchLeaderboards, fetchStreamSettings, fetchStats, loadMySubmissions, loadMyPrivateSounds, fetchMedia, loadMediaSubmissions]);

  // Load current audio for editing when audio editor is enabled
  useEffect(() => {
    if (!editingSound || !editingSoundAudioEnabled) return;

    let cancelled = false;

    const loadEditingAudio = async () => {
      setEditingSoundAudioLoading(true);
      setEditingSoundAudioError('');

      try {
        const response = await fetch(editingSound.url);
        if (!response.ok) {
          throw new Error('No se pudo cargar el audio actual para recortarlo.');
        }

        const blob = await response.blob();
        const inferredName = `${editingSound.id}.mp3`;
        const file = new File([blob], inferredName, { type: blob.type || 'audio/mpeg' });

        if (!cancelled) {
          setEditingSoundAudioFile(file);
        }
      } catch (err) {
        if (!cancelled) {
          setEditingSoundAudioFile(null);
          setEditingSoundAudioError(err instanceof Error ? err.message : 'No se pudo cargar el audio actual.');
        }
      } finally {
        if (!cancelled) {
          setEditingSoundAudioLoading(false);
        }
      }
    };

    void loadEditingAudio();

    return () => {
      cancelled = true;
    };
  }, [editingSound, editingSoundAudioEnabled]);

  // Cooldown countdowns & simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setSoundCooldown((c) => (c > 0 ? c - 1 : 0));
      setTtsCooldown((c) => (c > 0 ? c - 1 : 0));
      setAnimationCooldown((c) => (c > 0 ? c - 1 : 0));
      setUptimeSeconds((u) => u + 1);
    }, 1000);

    const viewersTimer = setInterval(() => {
      setViewers((v) => {
        const diff = Math.floor(Math.random() * 11) - 5; // -5 to +5
        const newVal = v + diff;
        return Math.max(1100, Math.min(1300, newVal));
      });
    }, 15000);

    return () => {
      clearInterval(timer);
      clearInterval(viewersTimer);
    };
  }, []);

  // Supabase Realtime Subscription for events and settings
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('stream-events-console')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_events' },
        (payload: { new: StreamEvent }) => {
          const newEvent = payload.new;
          setRecentEvents((prev) => {
            if (prev.some((e) => e.id === newEvent.id)) {
              return prev;
            }
            return [newEvent, ...prev.slice(0, 9)];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stream_settings', filter: 'id=eq.1' },
        (payload: { new: StreamSettings }) => {
          setStreamSettings(payload.new);
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          if (!warnedRealtimeRef.current) {
            console.log('[Console] Suscrito a eventos y ajustes en tiempo real');
            warnedRealtimeRef.current = true;
          }
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]);

  const handleTtsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttsText.trim() || sendingTts) return;
    void triggerEvent('tts', ttsText);
  };

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setRecordedFile(file);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      setRecordedFile(null);
      setRecordDuration(0);
      recordStartTimeRef.current = Date.now();
      recordTimerRef.current = setInterval(() => {
        setRecordDuration(Math.floor((Date.now() - recordStartTimeRef.current) / 1000));
      }, 200);
    } catch (err) {
      console.error('Recording error:', err);
      setError('No se pudo acceder al micrófono. Verificá los permisos del navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setRecordedFile(null);
    setRecordDuration(0);
  };

  const handleSendVoice = async () => {
    if (!recordedFile || sendingVoice) return;
    if (profile && (profile as Record<string, unknown>).perm_tts_record === false) {
      setError('No tenés permiso para usar TTS por grabación.');
      return;
    }
    setSendingVoice(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', recordedFile);
      const res = await fetch('/api/stream/events/voice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar audio');
      setSuccess('¡Mensaje de voz enviado! 🎤');
      setTimeout(() => setSuccess(null), 4000);
      discardRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSendingVoice(false);
    }
  };

  const handleBackToLanding = () => {
    soundManager.playPop();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#1e1f22] text-white flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFC200]" />
        <p className="mt-3 font-sans text-sm text-gray-500">Cargando Panel del Miembro...</p>
      </div>
    );
  }

  // Not logged in -> show warning
  if (!session) {
    return (
      <div className="h-screen w-screen bg-[#1e1f22] text-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-6 shadow-[0_8px_20px_rgba(0,0,0,0.25)] space-y-4">
          <div className="w-14 h-14 rounded-xl bg-red-950/40 border border-red-500 text-red-400 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-display font-bold text-2xl leading-none text-red-500">Acceso Restringido</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            Iniciá sesión en el portal de comunidad con tu cuenta autorizada para acceder al Panel del Miembro.
          </p>
          <button
            onClick={handleBackToLanding}
            className="w-full py-3 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97]"
          >
            <ArrowLeft className="w-4 h-4 stroke-[3]" />
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  // Profile pending/rejected/none -> show info card
  if (!profile || profile.link_status !== 'approved') {
    const isPending = profile?.link_status === 'pending';
    const isRejected = profile?.link_status === 'rejected';

    return (
      <div className="h-screen w-screen bg-[#1e1f22] text-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-6 shadow-[0_8px_20px_rgba(0,0,0,0.25)] space-y-4">
          <div className={`w-14 h-14 rounded-xl border flex items-center justify-center ${
            isPending ? 'bg-yellow-950/40 border-yellow-500 text-yellow-400' : 'bg-red-950/40 border-red-500 text-red-400'
          }`}>
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-display font-bold text-2xl leading-none">
            {isPending ? 'Postulación en Revisión' : isRejected ? 'Postulación Rechazada' : 'Vinculación Requerida'}
          </h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            {isPending
              ? 'Tu solicitud de vinculación está siendo evaluada por Milumon. Cuando seas aprobado como Miembro Oficial, se habilitará el Panel del Miembro.'
              : isRejected
              ? `Tu vinculación fue rechazada. Motivo: "${profile?.rejection_reason || 'Sin motivo especificado'}"`
              : 'Para acceder al Panel del Miembro debés completar tu onboarding y ser aprobado como Miembro Oficial.'}
          </p>
          <button
            onClick={handleBackToLanding}
            className="w-full py-3 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97]"
          >
            <ArrowLeft className="w-4 h-4 stroke-[3]" />
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const isMuted = streamSettings?.is_muted;

  // Soundboard cooldown math
  const maxSoundCd = Math.min(60, streamSettings?.personal_cooldown_seconds ?? 60);
  const soundCooldownPercent = soundCooldown > 0 ? (soundCooldown / maxSoundCd) * 100 : 0;

  // Animation cooldown math
  return (
    <div className="h-screen w-screen bg-[#1e1f22] text-white font-sans flex flex-col overflow-hidden select-none">

      {/* HEADER SUPERIOR */}
      <Header
        session={session}
        isAdmin={isAdmin}
        onLogout={handleBackToLanding}
         panelName={isAdmin ? 'Admin' : 'Panel del Miembro'}
         panelHref={isAdmin ? '/admin/inicio' : '/panel/inicio'}
        showMobileToggle={false}
        theme="dark"
      />

      {/* ----------------- CONTENEDOR PRINCIPAL DE PANELES ----------------- */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ----------------- SIDEBAR IZQUIERDA (280px) ----------------- */}
        <aside className="hidden md:flex flex-col justify-between w-[260px] shrink-0 bg-[#24262b] p-4 select-none">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 mb-3">Navegación</p>

            {PANEL_TABS.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = displayedTab === tab.id;
              const p = profile as Record<string, unknown> | null;
              const tabDisabled = !!(
                (tab.id === 'sounds' && p && !p.perm_trigger_sounds && !p.perm_upload_audio && !p.perm_edit_sounds) ||
                (tab.id === 'tts' && p && !p.perm_tts_text && !p.perm_tts_record) ||
                (tab.id === 'animations' && p && !p.perm_trigger_animations && !p.perm_trigger_media) ||
                (tab.id === 'nickname' && p && p.perm_edit_nickname === false)
              );
              return (
                <Link
                  key={tab.id}
                  href={tabDisabled ? '#' : tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-disabled={tabDisabled}
                  onClick={(e) => { if (tabDisabled) { e.preventDefault(); return; } soundManager.playPop(); }}
                  className={`w-full py-2.5 px-3 rounded-xl font-display font-semibold text-sm flex items-center gap-2.5 transition-all ${
                    tabDisabled
                      ? 'opacity-30 cursor-not-allowed pointer-events-none'
                      : isActive
                        ? 'bg-[#FFC200]/10 text-[#FFC200] cursor-pointer'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 cursor-pointer'
                  }`}
                >
                  <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FFC200]' : 'text-gray-500'}`} />
                  <span>{tab.label}</span>
                  {tabDisabled && <Ban className="w-3 h-3 ml-auto text-gray-600" />}
                </Link>
              );
            })}

          </div>

          {/* ESTADO Y POLLITO */}
          <div className="pt-4 border-t border-white/5 space-y-3 shrink-0">
            <div className="flex flex-col items-center py-3">
              <span className="text-4xl animate-bounce duration-1000 block">🐣</span>
              <p className="font-display font-semibold text-xs text-gray-500 mt-1.5">Milumon Mascot</p>
            </div>

            <div className="bg-white/5 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-300 leading-none">Sistema Online</p>
                  <span className="text-[10px] text-gray-500 leading-none">Sincronizado</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ÁREA CENTRAL DE CONTENIDO */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#1e1f22] pb-20 p-4 md:pb-6 md:p-6 lg:pb-7 lg:p-7">
          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">

              {/* TAB: DASHBOARD */}
              {displayedTab === 'dashboard' && (
                <MemberHomeView panelMode={panelMode} profile={profile} totalMembers={totalMembers} soundsToday={soundsToday} />
              )}

              {/* TAB: RANKINGS */}
              {displayedTab === 'rankings' && (
                <motion.div
                  key="rankings-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 overflow-hidden"
                >
                   <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin">
                     <TikTokRankingConsole accessToken={session.access_token} />
                     <TikTokRankingHistory accessToken={session.access_token} />
                   </div>
                </motion.div>
              )}

              {/* TAB: BANCO */}
              {displayedTab === 'sounds' && (
                <MemberSoundsView
                  panelMode={panelMode}
                  displayedSoundType={displayedSoundType}
                  streamSettings={streamSettings}
                  session={session}
                  profile={profile}
                  sounds={sounds}
                  loadingSounds={loadingSounds}
                  soundCooldown={soundCooldown}
                  soundCooldownPercent={soundCooldownPercent}
                  isLocalTestMode={isLocalTestMode}
                  isMuted={isMuted}
                  triggeringId={triggeringId}
                  soundDurations={soundDurations}
                  mySubmissions={mySubmissions}
                  recentEvents={recentEvents}
                  customImageMessage={customImageMessage}
                  sendMessageEnabled={sendMessageEnabled}
                  sendRepeatEnabled={sendRepeatEnabled}
                  localTestAudioRef={localTestAudioRef}
                  localTestVideoRef={localTestVideoRef}
                  setSoundboardSubTab={() => {}}
                  setCustomImageMessage={setCustomImageMessage}
                  setSendMessageEnabled={setSendMessageEnabled}
                  setSendRepeatEnabled={setSendRepeatEnabled}
                  setError={setError}
                  setSuccess={setSuccess}
                  setLocalTestMode={setIsLocalTestMode}
                  setLocalTestOverlay={setLocalTestOverlay}
                  setEditingSound={setEditingSound}
                  setEditSoundName={setEditSoundName}
                  setEditSoundCooldown={setEditSoundCooldown}
                  setEditSoundPublic={setEditSoundPublic}
                  setEditingSource={setEditingSource}
                  setEditingSoundAudioEnabled={setEditingSoundAudioEnabled}
                  setEditingSoundAudioFile={setEditingSoundAudioFile}
                  setEditingSoundAudioTrim={setEditingSoundAudioTrim}
                  setEditingSoundAudioError={setEditingSoundAudioError}
                  setEditVideoTrimStart={setEditVideoTrimStart}
                  setEditVideoTrimEnd={setEditVideoTrimEnd}
                  setEditVideoDuration={setEditVideoDuration}
                  fetchSounds={fetchSounds}
                  fetchLeaderboards={fetchLeaderboards}
                  fetchMedia={fetchMedia}
                  loadMediaSubmissions={loadMediaSubmissions}
                  triggerEvent={(type, content, bypassConfirm, mediaUrls) => { void triggerEvent(type, content, bypassConfirm, mediaUrls); }}
                />
              )}

              {/* TAB: TTS */}
              {displayedTab === 'tts' && (
                <MemberVoicePanel
                  mode={displayedTtsMode}
                  panelMode={panelMode}
                  text={ttsText}
                  cooldown={ttsCooldown}
                  sendingText={sendingTts}
                  isMuted={isMuted}
                  isRecording={isRecording}
                  hasRecording={recordedBlob !== null}
                  recordDuration={recordDuration}
                  sendingVoice={sendingVoice}
                   audioPreview={recordedFile ? <AudioPreview file={recordedFile} onTrimChange={() => {}} /> : null}
                  onModeChange={() => {}}
                  onTextChange={setTtsText}
                  onTextSubmit={handleTtsSubmit}
                  onStartRecording={() => void startRecording()}
                  onStopRecording={stopRecording}
                  onDiscardRecording={discardRecording}
                  onSendVoice={() => void handleSendVoice()}
                />
              )}

              {/* TAB: ANIMATIONS */}
              {displayedTab === 'animations' && (
                <MemberEffectsPanel
                  animations={ANIMATIONS}
                  cooldown={animationCooldown}
                  triggeringId={triggeringId}
                  isMuted={isMuted}
                  onTrigger={(animationId) => void triggerEvent('animation', animationId)}
                />
              )}

              {/* TAB: FEED */}
              {displayedTab === 'feed' && (
                <motion.div
                  key="feed-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex flex-col overflow-hidden text-left"
                >
                  <div className="flex-1 bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3 mb-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <List className="w-5 h-5 text-gray-400" />
                        <div>
                          <h2 className="font-display font-bold text-base md:text-lg text-white">Top de la Semana</h2>
                          <p className="text-[10px] text-gray-500 font-semibold mt-1">Compite, participa y escala el ranking</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-neutral-800 rounded-lg px-2.5 py-0.5 font-medium text-gray-500">
                        Se reinicia cada lunes
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                      {loadingLeaderboards ? (
                        <div className="py-12 text-center text-xs font-bold text-gray-500 uppercase animate-pulse">Cargando ranking...</div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {LEADERBOARD_SECTIONS.map((section) => {
                            const entries = weeklyLeaderboards[section.key];
                            return (
                              <section key={section.key} className="bg-[#24262b] border border-neutral-700/60 rounded-2xl p-3.5">
                                <div className="flex items-center gap-2 border-b border-neutral-700/60 pb-2.5 mb-3">
                                  <span className="text-lg">{section.icon}</span>
                                  <h3 className="font-display font-bold text-xs text-white">{section.title}</h3>
                                </div>

                                {entries.length === 0 ? (
                                  <p className="text-[10px] text-gray-500 font-semibold py-5 text-center">Todavía no hay datos esta semana.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {entries.map((entry, index) => (
                                      <div
                                        key={entry.userId}
                                        className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${index === 0 ? 'bg-[#FFC200]/10 border border-[#FFC200]/50 shadow-[0_0_16px_rgba(255,194,0,.12)]' : 'bg-[#2b2d31] border border-neutral-700/40'}`}
                                      >
                                        <span className={`w-5 text-center font-black ${index === 0 ? 'text-[#FFC200] text-base' : 'text-gray-500 text-xs'}`}>
                                          {index === 0 ? '👑' : `${index + 1}.`}
                                        </span>
                                        {index === 0 ? (
                                          <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#FFC200] bg-[#35373d] shrink-0 flex items-center justify-center">
                                            {entry.avatarUrl ? (
                                              <Image src={entry.avatarUrl} alt={`Avatar de ${entry.name}`} fill sizes="40px" unoptimized className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-xl">🐣</span>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="relative w-7 h-7 rounded-full overflow-hidden border border-neutral-600 bg-[#35373d] shrink-0 flex items-center justify-center">
                                            {entry.avatarUrl ? <Image src={entry.avatarUrl} alt="" fill sizes="28px" unoptimized className="w-full h-full object-cover" /> : <span className="text-sm">🐣</span>}
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <p className={`truncate font-bold ${index === 0 ? 'text-[#FFC200] text-xs' : 'text-white text-[11px]'}`}>@{entry.name}</p>
                                          <p className="text-[9px] text-gray-500 font-semibold">{entry.count} {section.suffix}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </section>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-6 pt-5 border-t border-neutral-700/60">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h2 className="font-display font-bold text-base md:text-lg text-white">Top de Todos los Tiempos</h2>
                            <p className="text-[10px] text-gray-500 font-semibold mt-1">El ranking histórico de la comunidad</p>
                          </div>
                          <span className="text-lg">🏆</span>
                        </div>
                        <LeaderboardGrid leaderboards={allTimeLeaderboards} loading={loadingLeaderboards} emptyLabel="Todavía no hay datos históricos." />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB: NICKNAME */}
              {displayedTab === 'nickname' && (
                <motion.div
                  key="nickname-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex flex-col overflow-hidden max-w-xl mx-auto w-full text-left"
                >
                  <div className="flex-1 bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3 mb-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        <h2 className="font-display font-bold text-base md:text-lg text-white">Cambiar mi Nickname</h2>
                      </div>
                      <span className="text-[10px] bg-neutral-800 rounded-lg px-2.5 py-0.5 font-medium text-gray-500">
                        Tag de Roblox
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      <form onSubmit={handleNicknameSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-gray-500 tracking-wider uppercase">
                            Tu nombre central (Sin emojis)
                          </label>
                          <input
                            type="text"
                            value={newNickname}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.length <= MEMBER_DISPLAY_NAME_MAX_LENGTH) {
                                  setNewNickname(val);
                              }
                            }}
                            placeholder="Ej: Milumon"
                            minLength={MEMBER_DISPLAY_NAME_MIN_LENGTH}
                            maxLength={MEMBER_DISPLAY_NAME_MAX_LENGTH}
                            pattern={MEMBER_DISPLAY_NAME_INPUT_PATTERN}
                            title="Usa letras, números, espacios y, como máximo, un guion bajo en posición intermedia."
                            disabled={submittingNickname}
                            className="w-full bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-3 font-semibold text-sm outline-none focus:border-[#FFC200] focus:ring-1 focus:ring-[#FFC200] disabled:opacity-50 text-white placeholder-gray-500 "
                            required
                          />
                          <div className="flex justify-between text-[8px] font-mono text-gray-500">
                            <span>Letras, números, espacios y un _ intermedio</span>
                            <span>{newNickname.length}/{MEMBER_DISPLAY_NAME_MAX_LENGTH}</span>
                          </div>
                        </div>

                        {/* VISTA PREVIA */}
                        <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 text-center space-y-1 ">
                          <span className="text-[10px] font-medium text-[#FFC200] tracking-wider uppercase block">Vista previa en el juego</span>
                          <span className="font-display font-semibold text-lg text-white">
                            🐣 {newNickname.trim() || 'TuNombre'} 🐣
                          </span>
                        </div>

                        {nicknameError && (
                          <div className="bg-red-950/80 border border-red-500 rounded-2xl p-3 text-[10px] font-semibold text-red-300 ">
                            ⚠️ {nicknameError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submittingNickname || newNickname.trim().length < MEMBER_DISPLAY_NAME_MIN_LENGTH || newNickname.trim().length > MEMBER_DISPLAY_NAME_MAX_LENGTH}
                          className="w-full py-3.5 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-xs rounded-lg border border-neutral-700/60 transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,.3)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {submittingNickname ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-black" />
                              Guardando y Etiquetando...
                            </>
                          ) : (
                            'Confirmar Nickname 🐣'
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB: SETTINGS */}
              {displayedTab === 'settings' && (
                <motion.div
                  key="settings-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex flex-col overflow-hidden max-w-xl mx-auto w-full text-left"
                >
                  <div className="flex-1 bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3 mb-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-400" />
                        <h2 className="font-display font-bold text-base md:text-lg text-white">Configuración de Cuenta</h2>
                      </div>
                      <span className="text-[10px] bg-neutral-800 rounded-lg px-2.5 py-0.5 font-medium text-gray-500">
                        Ajustes
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 space-y-3 ">
                        <h3 className="font-display font-medium text-xs text-gray-500">Vinculaciones Activas</h3>

                        <div className="space-y-3.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-bold">Usuario Roblox:</span>
                            <span className="font-mono text-white">@{profile.roblox_user}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-bold">Usuario TikTok:</span>
                            <span className="font-mono text-white">@{profile.tiktok_user || 'No Vinculado'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-bold">Estado de Cuenta:</span>
                            <span className="text-emerald-400 font-semibold text-xs bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full ">Aprobado VIP</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-700/40">
                          <button
                            type="button"
                            onClick={() => setIsRobloxOnboardingOpen(true)}
                            className="w-full py-2 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-xs rounded-xl transition-all cursor-pointer active:scale-[0.97]"
                          >
                            Modificar Cuentas Vinculadas
                          </button>
                        </div>
                      </div>

                      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 space-y-3 ">
                        <h3 className="font-display font-medium text-xs text-gray-500">Mis Permisos</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                          Permisos asignados por un administrador. Si necesitas acceso adicional, contacta al admin del equipo.
                        </p>
                        {(() => {
                          const perms = [
                            { key: 'perm_trigger_sounds', label: 'Activar sonidos' },
                            { key: 'perm_trigger_media', label: 'Activar media (imágenes/audio)' },
                            { key: 'perm_trigger_animations', label: 'Activar animaciones' },
                            { key: 'perm_tts_text', label: 'TTS por texto' },
                            { key: 'perm_tts_record', label: 'TTS por grabación' },
                            { key: 'perm_upload_images', label: 'Subir imágenes' },
                            { key: 'perm_upload_videos', label: 'Subir videos' },
                            { key: 'perm_upload_audio', label: 'Subir audio' },
                            { key: 'perm_edit_nickname', label: 'Cambiar nickname' },
                            { key: 'perm_edit_sounds', label: 'Editar sonidos' },
                          ];
                          const p = profile as Record<string, unknown> | null;
                          return (
                            <div className="space-y-1.5">
                              {perms.map(({ key, label }) => {
                                const enabled = p ? p[key] !== false : true;
                                return (
                                  <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/5">
                                    <span className="text-xs font-semibold text-gray-300">{label}</span>
                                    {enabled ? (
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                        <Check className="w-3 h-3" /> Activo
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-full">
                                        <Ban className="w-3 h-3" /> Deshabilitado
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 space-y-3 ">
                        <h3 className="font-display font-medium text-xs text-gray-500">Seguridad Anti-Spam (Niños)</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                          Cuando está activado, solicita una confirmación en pantalla antes de reproducir sonidos o efectos. Ideal para evitar toques involuntarios.
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="confirm-spam-guard-checkbox"
                            checked={confirmSpamGuard}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setConfirmSpamGuard(val);
                              window.localStorage.setItem('confirmSpamGuard', String(val));
                            }}
                            className="w-4 h-4 cursor-pointer accent-[#FFC200]"
                          />
                          <label htmlFor="confirm-spam-guard-checkbox" className="text-xs font-bold text-white select-none cursor-pointer">
                            Confirmar antes de disparar sonidos/efectos
                          </label>
                        </div>
                      </div>

                      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 space-y-3 ">
                        <h3 className="font-display font-medium text-xs text-gray-500">Sesión</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                          Si cambiaste de cuenta de Google o necesitas desvincular tus credenciales, puedes cerrar sesión aquí.
                        </p>
                        <button
                          onClick={handleBackToLanding}
                          className="px-4 py-2 bg-red-950 hover:bg-red-900 border border-neutral-700/60 text-red-300 font-display font-medium text-xs rounded-xl transition-all cursor-pointer active:scale-[0.97]"
                        >
                          Cerrar Sesión VIP
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB: HELP */}
              {displayedTab === 'help' && (
                <motion.div
                  key="help-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex flex-col overflow-y-auto pr-1 space-y-4 text-left"
                >
                  <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-3">
                    <div className="flex items-center gap-2 border-b border-neutral-700/60 pb-3 mb-2 shrink-0">
                      <HelpCircle className="w-5 h-5 text-gray-400" />
                      <h2 className="font-display font-bold text-base md:text-lg text-white">Preguntas Frecuentes</h2>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-white">¿Por qué mis botones de sonido están deshabilitados?</h4>
                        <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                          Si disparaste un sonido recientemente, tendrás que esperar tu cooldown personal. También puede suceder que el panel esté bajo un **Mute Global** activado por el moderador del stream.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-white">¿Cuánto tarda en sonar mi efecto en el stream?</h4>
                        <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                          La latencia promedio es inferior a 100 ms gracias a Supabase Realtime. El retraso que veas dependerá de la latencia nativa de la plataforma de stream (TikTok/Kick).
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-white">¿Cómo puedo reportar un problema de sonido?</h4>
                        <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                          Si un efecto de sonido falla o no se escucha, por favor escribe al soporte o avisa a los moderadores de la comunidad en Discord.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* ----------------- SIDEBAR DERECHA (360px - WIDGETS FIJOS) ----------------- */}
        <aside className="hidden xl:flex w-[360px] shrink-0 bg-[#2b2d31] border-l border-neutral-700/60 flex-col p-5 gap-4 overflow-y-auto select-none text-left shadow-[-4px_0_0_0_#000]">
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 space-y-3 shadow-[0_2px_8px_rgba(0,0,0,.25)]">
              <div className="flex items-center justify-between border-b border-neutral-700/60 pb-2">
                <h3 className="font-display font-semibold text-xs text-[#FFC200] flex items-center gap-1.5 leading-none">
                  🕘 Uso Reciente
                </h3>
                <span className="text-[8px] text-gray-500 font-mono uppercase">Feed rápido</span>
              </div>

              <div className="space-y-2">
                {recentEvents.length === 0 ? (
                  <p className="text-[10px] text-gray-500 font-bold py-2">Ninguna interacción reciente</p>
                ) : (
                  recentEvents.slice(0, 5).map((evt) => {
                    let label = '';
                    if (evt.type === 'sound' || evt.type === 'audio') {
                      label = sounds.find(s => s.id === evt.content)?.name || evt.content;
                    } else if (evt.type === 'image' || evt.type === 'image_audio' || evt.type === 'video') {
                      label = evt.content;
                    } else if (evt.type === 'tts') {
                      label = `TTS: "${evt.content}"`;
                    } else if (evt.type === 'animation') {
                      label = `Efecto: ${evt.content}`;
                    }

                    return (
                      <div key={evt.id} className="bg-[#35373d] border border-neutral-700/40 rounded-xl px-2.5 py-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-[10px] text-white truncate">@{evt.sender_roblox_user || 'VIP'}</strong>
                          <span className="font-mono text-[8px] text-gray-500 shrink-0">
                            {new Date(evt.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{label || 'Interacción'}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

        </aside>
      </div>

      {/* ----------------- MOBILE BOTTOM NAV BAR ----------------- */}
      <nav className="flex md:hidden h-16 bg-[#2b2d31] border-t border-neutral-700/40 items-center justify-around z-20 shrink-0 px-2 select-none rounded-t-2xl shadow-[0_-4px_0_0_#000]">
        {PANEL_TABS.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = displayedTab === tab.id;
          const p = profile as Record<string, unknown> | null;
          const tabDisabled = !!(
            (tab.id === 'sounds' && p && !p.perm_trigger_sounds && !p.perm_upload_audio && !p.perm_edit_sounds) ||
            (tab.id === 'tts' && p && !p.perm_tts_text && !p.perm_tts_record) ||
            (tab.id === 'animations' && p && !p.perm_trigger_animations && !p.perm_trigger_media) ||
            (tab.id === 'nickname' && p && p.perm_edit_nickname === false)
          );
          return (
            <Link
              key={tab.id}
              href={tabDisabled ? '#' : tab.href}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={tabDisabled}
              onClick={(e) => { if (tabDisabled) { e.preventDefault(); return; } soundManager.playPop(); }}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl border border-transparent transition-all ${
                tabDisabled
                  ? 'opacity-30 cursor-not-allowed pointer-events-none'
                  : isActive
                    ? 'text-[#FFC200] font-semibold cursor-pointer'
                    : 'text-gray-500 font-bold cursor-pointer'
              }`}
            >
              <IconComponent className="w-4.5 h-4.5" />
              <span className="text-[8px] uppercase tracking-wide">{tab.label}</span>
            </Link>
          );
        })}

      </nav>

      {/* ----------------- NICKNAME ONBOARDING MODAL (Solo primer ingreso) ----------------- */}
      <AnimatePresence>
        {isNicknameModalOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-6 max-w-md w-full shadow-[0_4px_12px_rgba(0,0,0,.25)] relative space-y-4 text-left pointer-events-auto"
            >
              {profile && isCustomNickname(profile.roblox_display_name) && (
                <button
                  onClick={() => {
                    setIsNicknameModalOpen(false);
                    setNicknameError(null);
                  }}
                  className="absolute top-4 right-4 w-8 h-8 bg-[#2b2d31] hover:bg-neutral-900 border border-neutral-700/60 rounded-2xl flex items-center justify-center font-black cursor-pointer text-white  active:scale-[0.97]"
                >
                  ✕
                </button>
              )}

              <div className="text-center space-y-2">
                <span className="text-5xl block animate-bounce">🐣</span>
                <h2 className="font-display font-bold text-xl leading-none text-[#FFC200] tracking-tight">
                  {profile && !isCustomNickname(profile.roblox_display_name) ? '¡Elige tu Nickname Oficial!' : 'Modificar tu Nickname'}
                </h2>
                <p className="text-[11px] font-semibold text-gray-400 leading-relaxed text-center">
                  {profile && !isCustomNickname(profile.roblox_display_name)
                    ? 'Como Miembro Oficial del Team Pollito, tu nombre en el juego debe llevar los pollitos a los costados.'
                    : 'Puedes cambiar la parte central de tu nickname. Recuerda el cooldown de 24 horas.'}
                </p>
              </div>

              <form onSubmit={handleNicknameSubmit} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-gray-500 tracking-wider uppercase">
                    Tu nombre central
                  </label>
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.length <= MEMBER_DISPLAY_NAME_MAX_LENGTH) {
                        setNewNickname(val);
                      }
                    }}
                    placeholder="Ej: Milumon"
                    minLength={MEMBER_DISPLAY_NAME_MIN_LENGTH}
                    maxLength={MEMBER_DISPLAY_NAME_MAX_LENGTH}
                    pattern={MEMBER_DISPLAY_NAME_INPUT_PATTERN}
                    title="Usa letras, números, espacios y, como máximo, un guion bajo en posición intermedia."
                    disabled={submittingNickname}
                    className="w-full bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-3 font-semibold text-sm outline-none focus:border-[#FFC200] focus:ring-1 focus:ring-[#FFC200] text-white placeholder-gray-600 "
                    required
                  />
                  <div className="flex justify-between text-[8px] font-mono text-gray-500">
                    <span>Letras, números, espacios y un _ intermedio</span>
                    <span>{newNickname.length}/{MEMBER_DISPLAY_NAME_MAX_LENGTH}</span>
                  </div>
                </div>

                {/* VISTA PREVIA */}
                <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 text-center space-y-1 ">
                  <span className="text-[10px] font-medium text-[#FFC200] tracking-wider uppercase block">Vista previa en el juego</span>
                  <span className="font-display font-semibold text-lg text-white">
                    🐣 {newNickname.trim() || 'TuNombre'} 🐣
                  </span>
                </div>

                {nicknameError && (
                  <div className="bg-red-950/80 border border-red-500 rounded-2xl p-3 text-[10px] font-semibold text-red-300 ">
                    ⚠️ {nicknameError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingNickname || newNickname.trim().length < MEMBER_DISPLAY_NAME_MIN_LENGTH || newNickname.trim().length > MEMBER_DISPLAY_NAME_MAX_LENGTH}
                  className="w-full py-3 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-xs rounded-lg border border-neutral-700/60 transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,.3)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submittingNickname ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      Guardando y Etiquetando...
                    </>
                  ) : (
                    'Confirmar Nickname 🐣'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsNicknameModalOpen(false);
                    setIsRobloxOnboardingOpen(true);
                  }}
                  className="w-full text-center text-[10px] font-bold text-gray-400 hover:text-white underline cursor-pointer pt-2 block"
                >
                  ¿No es tu cuenta de Roblox o TikTok? Corregir datos
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL DE PROTECCIÓN ANTI-SPAM ----------------- */}
      <AnimatePresence>
        {pendingTrigger && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-6 max-w-md w-full shadow-[0_4px_24px_rgba(0,0,0,.5)] relative space-y-4 text-left pointer-events-auto"
            >
              <div className="flex items-center gap-3 border-b border-neutral-700/40 pb-3 mb-2 shrink-0">
                <div className={`p-2 rounded-xl border ${
                  pendingTrigger.type === 'sound'
                    ? 'bg-[#FFC200]/10 border-[#FFC200]/20 text-[#FFC200]'
                    : pendingTrigger.type === 'animation'
                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                    : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                }`}>
                  {pendingTrigger.type === 'sound' && <Volume2 className="w-5 h-5" />}
                  {pendingTrigger.type === 'animation' && <Sparkles className="w-5 h-5" />}
                  {pendingTrigger.type === 'tts' && <Send className="w-5 h-5" />}
                </div>
                <h2 className="font-display font-bold text-lg leading-none text-white tracking-tight">
                  {pendingTrigger.type === 'sound' && 'Confirmar Sonido'}
                  {pendingTrigger.type === 'animation' && 'Confirmar Animación'}
                  {pendingTrigger.type === 'tts' && 'Confirmar Mensaje de Voz'}
                </h2>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-300 leading-relaxed">
                  {pendingTrigger.message}
                </p>

                {/* Vista previa rápida del contenido si corresponde */}
                {pendingTrigger.type === 'sound' && (
                  <div className="bg-neutral-800 rounded-xl p-3 border border-neutral-700/40">
                    <span className="text-[10px] font-medium text-gray-500 tracking-wider uppercase block">Sonido seleccionado</span>
                    <span className="font-display font-medium text-xs text-white">
                      📢 {sounds.find(s => s.id === pendingTrigger.content)?.name || pendingTrigger.content}
                    </span>
                  </div>
                )}
                {pendingTrigger.type === 'animation' && (
                  <div className="bg-neutral-800 rounded-xl p-3 border border-neutral-700/40">
                    <span className="text-[10px] font-medium text-gray-500 tracking-wider uppercase block">Animación seleccionada</span>
                    <span className="font-display font-medium text-xs text-white">
                      🎬 {ANIMATIONS.find(a => a.id === pendingTrigger.content)?.name || pendingTrigger.content}
                    </span>
                  </div>
                )}
                {pendingTrigger.type === 'tts' && (
                  <div className="bg-neutral-800 rounded-xl p-3 border border-neutral-700/40 max-h-24 overflow-y-auto scrollbar-thin">
                    <span className="text-[10px] font-medium text-gray-500 tracking-wider uppercase block">Mensaje de voz</span>
                    <span className="font-sans text-xs text-white italic">
                      &quot;{pendingTrigger.content}&quot;
                    </span>
                  </div>
                )}
                {(pendingTrigger.type === 'image' || pendingTrigger.type === 'image_audio' || pendingTrigger.type === 'video') && (
                  <div className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700/40">
                    <span className="text-[10px] font-medium text-gray-500 tracking-wider uppercase block mb-2">Mensaje (opcional)</span>
                    <input
                      type="text"
                      value={customImageMessage}
                      onChange={(e) => setCustomImageMessage(e.target.value)}
                      placeholder="Milu cuando no se baña:"
                      maxLength={120}
                      className="w-full bg-neutral-900 border border-neutral-700/60 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 font-medium focus:outline-none focus:border-[#FFC200]/60 transition-colors"
                      autoFocus
                    />
                    {false && (pendingTrigger?.type === 'image' || pendingTrigger?.type === 'image_audio') && (streamSettings?.overlay_media_repeat_count ?? 1) > 1 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
                        <input
                          type="checkbox"
                          checked={sendRepeatEnabled}
                          onChange={(e) => setSendRepeatEnabled(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#FFC200] cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-400 font-medium leading-tight">
                          Enviar con repeticiones ({streamSettings?.overlay_media_repeat_count ?? 1}x)
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modal-dont-ask-checkbox"
                  checked={!confirmSpamGuard}
                  onChange={(e) => {
                    const disableSpamGuard = e.target.checked;
                    setConfirmSpamGuard(!disableSpamGuard);
                    window.localStorage.setItem('confirmSpamGuard', String(!disableSpamGuard));
                  }}
                  className="w-4 h-4 cursor-pointer accent-[#FFC200]"
                />
                <label htmlFor="modal-dont-ask-checkbox" className="text-xs font-bold text-gray-400 hover:text-white select-none cursor-pointer">
                  No volver a preguntar (desactivar protección)
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingTrigger(null)}
                  className="flex-1 py-3 bg-[#2b2d31] hover:bg-neutral-900 border border-neutral-700/60 rounded-xl text-gray-400 hover:text-white font-display font-semibold text-xs transition-all cursor-pointer active:scale-[0.97]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTrigger}
                  className={`flex-1 py-3 font-display font-semibold text-xs rounded-xl border border-neutral-700/60 transition-all cursor-pointer active:scale-[0.97] ${
                    pendingTrigger.type === 'sound'
                      ? 'bg-[#FFC200] hover:brightness-105 text-black'
                      : pendingTrigger.type === 'animation'
                      ? 'bg-cyan-500 hover:bg-cyan-600 text-black'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  Enviar 🚀
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ERROR/SUCCESS BANNERS */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs font-bold text-red-400 shadow-lg backdrop-blur-sm max-w-sm text-center animate-slide-in">
          ⚠️ {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">✕</button>
        </div>
      )}
      {success && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/90 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-400 shadow-lg backdrop-blur-sm max-w-sm text-center animate-slide-in">
          ✓ {success}
          <button onClick={() => setSuccess(null)} className="ml-2 text-emerald-400 hover:text-emerald-300">✕</button>
        </div>
      )}

      {/* ROBLOX ONBOARDING MODAL */}
      <RobloxOnboarding
        isOpen={isRobloxOnboardingOpen}
        onClose={() => setIsRobloxOnboardingOpen(false)}
        onConfirm={async () => {
          if (session) {
            await fetchProfile(session);
          }
        }}
        userSession={session ? { session } : null}
        currentProfile={profile ? {
          displayName: profile.roblox_display_name || profile.roblox_user || 'Pollito',
          avatarUrl: profile.roblox_avatar_url || null,
          username: profile.roblox_user || null,
          tiktokUser: profile.tiktok_user || null,
          linkStatus: profile.link_status || 'none',
          rejectionReason: profile.rejection_reason || null,
        } : null}
      />

      {/* EDIT SOUND MODAL */}
      {editingSound && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6" onClick={() => { setEditingSound(null); setEditingSoundAudioEnabled(false); setEditVideoDuration(0); }}>
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl w-full max-w-sm sm:max-w-lg lg:max-w-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-h-[90vh] sm:max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-700/60 shrink-0">
              <h3 className="font-display font-bold text-base text-white">Editar</h3>
              <p className="text-[10px] text-gray-500 mt-0.5 font-semibold">Modificá el nombre, cooldown, visibilidad o recortá la media.</p>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Row: Name + Cooldown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={editSoundName}
                    onChange={(e) => setEditSoundName(e.target.value)}
                    className="w-full bg-[#35373d] border border-neutral-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FFC200] focus:ring-1 focus:ring-[#FFC200]/30 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Cooldown (segundos)</label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={editSoundCooldown}
                    onChange={(e) => setEditSoundCooldown(e.target.value)}
                    className="w-full bg-[#35373d] border border-neutral-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FFC200] focus:ring-1 focus:ring-[#FFC200]/30 transition-all"
                  />
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Visibilidad</label>
                <button
                  onClick={() => setEditSoundPublic(!editSoundPublic)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    editSoundPublic
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}
                >
                  {editSoundPublic ? '🌍 Público' : '🔒 Privado'}
                </button>
              </div>

              {/* Video/Image Preview */}
              {editingSound?.media_type === 'video' && editingSound?.video_url && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Vista previa del video</label>
                  <video controls src={editingSound.video_url} className="w-full max-h-48 rounded-lg" onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    setEditVideoDuration(dur);
                    if (editVideoTrimEnd === 0 || editVideoTrimEnd > dur) {
                      setEditVideoTrimEnd(dur);
                    }
                  }} />
                  <p className="text-[9px] text-gray-500 mt-1 text-center font-semibold">El recorte se aplica en transmisión. Usá los campos debajo para ajustar.</p>
                </div>
              )}
              {editingSound?.media_type === 'image' && editingSound?.image_url && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Vista previa de la imagen</label>
                  <Image src={editingSound.image_url} alt="Preview" width={640} height={192} unoptimized className="w-full max-h-48 object-contain rounded-lg" />
                </div>
              )}
              {editingSound?.media_type === 'image_audio' && editingSound?.image_url && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Vista previa</label>
                  <div className="flex gap-2">
                    <Image src={editingSound.image_url} alt="Preview" width={320} height={160} unoptimized className="w-1/2 max-h-40 object-contain rounded-lg" />
                    {editingSound.audio_url && <audio controls src={editingSound.audio_url} className="w-1/2" />}
                  </div>
                </div>
              )}

              {/* Video Trim — for video media types */}
              {editingSound?.media_type === 'video' && editVideoDuration > 0 && (
                <div className="border border-neutral-700/40 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#35373d] flex items-center gap-2">
                    <Scissors className="w-3.5 h-3.5 text-[#FFC200]" />
                    <span className="text-xs font-bold text-gray-300">Recortar video</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <label className="text-[9px] text-gray-500 font-bold w-12 text-right">Inicio</label>
                      <input
                        type="range" min={0} max={editVideoDuration} step={0.1}
                        value={editVideoTrimStart}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setEditVideoTrimStart(v);
                          if (v >= editVideoTrimEnd) setEditVideoTrimEnd(Math.min(v + 1, editVideoDuration));
                        }}
                        className="flex-1 accent-[#FFC200] h-1"
                      />
                      <span className="text-[9px] font-mono text-gray-400 w-10">{editVideoTrimStart.toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-[9px] text-gray-500 font-bold w-12 text-right">Fin</label>
                      <input
                        type="range" min={0} max={editVideoDuration} step={0.1}
                        value={editVideoTrimEnd}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setEditVideoTrimEnd(v);
                          if (v <= editVideoTrimStart) setEditVideoTrimStart(Math.max(v - 1, 0));
                        }}
                        className="flex-1 accent-[#FFC200] h-1"
                      />
                      <span className="text-[9px] font-mono text-gray-400 w-10">{editVideoTrimEnd.toFixed(1)}s</span>
                    </div>
                    <p className="text-[9px] text-gray-500 text-center">
                      Duración recortada: <span className="font-mono text-[#FFC200]">{(editVideoTrimEnd - editVideoTrimStart).toFixed(1)}s</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Audio Editor — collapsible */}
              <div className="border border-neutral-700/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEditingSoundAudioEnabled(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#35373d] hover:bg-[#3a3c42] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Scissors className="w-3.5 h-3.5 text-[#FFC200]" />
                    <span className="text-xs font-bold text-gray-300">Editar audio (recortar)</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-bold">{editingSoundAudioEnabled ? '▲ Colapsar' : '▼ Expandir'}</span>
                </button>

                {editingSoundAudioEnabled && (
                  <div className="p-4 bg-[#2b2d31] border-t border-neutral-700/40">
                    {editingSoundAudioLoading ? (
                      <div className="py-8 text-center text-gray-500 text-xs animate-pulse">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FFC200]" />
                        Cargando audio actual...
                      </div>
                    ) : editingSoundAudioError ? (
                      <div className="py-6 text-center">
                        <p className="text-xs text-red-400 font-semibold">{editingSoundAudioError}</p>
                      </div>
                    ) : editingSoundAudioFile ? (
                      <>
                        <AudioPreview
                          file={editingSoundAudioFile}
                          onTrimChange={(start, end) => setEditingSoundAudioTrim({ start, end })}
                          embedded
                        />
                        <p className="text-[10px] text-gray-500 text-center font-semibold mt-3">
                          Recortá el audio y presioná &quot;Guardar todo&quot; para aplicar los cambios.
                        </p>
                      </>
                    ) : (
                      <div className="py-6 text-center text-gray-500 text-xs">
                        No se pudo cargar el audio actual.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status */}
              {audioSubmitStatus && (
                <p className={`text-xs font-semibold ${audioSubmitStatus.startsWith('✓') ? 'text-emerald-400' : 'text-[#FFC200]'}`}>
                  {audioSubmitStatus}
                </p>
              )}
            </div>

            {/* Footer — fixed */}
            <div className="px-6 py-4 border-t border-neutral-700/60 shrink-0 flex gap-3">
              <button
                onClick={() => { setEditingSound(null); setEditingSoundAudioEnabled(false); setEditVideoDuration(0); }}
                className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-display font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSound}
                disabled={savingSoundEdit || !editSoundName.trim()}
                className="flex-1 py-3 bg-[#FFC200] hover:brightness-105 text-black font-display font-bold text-sm rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSoundEdit ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCAL TEST OVERLAY — fullscreen within console */}
      {localTestOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => {
          if (localTestAudioRef.current) { localTestAudioRef.current.pause(); localTestAudioRef.current = null; }
          if (localTestVideoRef.current) { localTestVideoRef.current.pause(); localTestVideoRef.current = null; }
          setLocalTestOverlay(null);
        }}>
          <div className="relative max-w-[90vw] max-h-[80vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-white text-xs font-bold bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">{localTestOverlay.name}</p>

            {localTestOverlay.type === 'image' && localTestOverlay.image_url && (
              <Image src={localTestOverlay.image_url} alt="" width={800} height={600} unoptimized className="max-w-[80vw] max-h-[70vh] object-contain rounded-xl shadow-2xl" />
            )}

            {localTestOverlay.type === 'image_audio' && localTestOverlay.image_url && (
              <Image src={localTestOverlay.image_url} alt="" width={800} height={600} unoptimized className="max-w-[80vw] max-h-[70vh] object-contain rounded-xl shadow-2xl" />
            )}

            {localTestOverlay.type === 'video' && localTestOverlay.video_url && (
              <video
                ref={localTestVideoRef}
                src={localTestOverlay.video_url}
                autoPlay
                muted
                className="max-w-[80vw] max-h-[70vh] object-contain rounded-xl shadow-2xl"
                onEnded={() => setLocalTestOverlay(null)}
                onLoadedMetadata={() => {
                  const video = localTestVideoRef.current;
                  if (video) {
                    const start = localTestOverlay.trim_start ?? 0;
                    const end = localTestOverlay.trim_end;
                    video.currentTime = start;
                    if (end && end > start) {
                      const checkTime = () => {
                        if (video.currentTime >= end) {
                          video.pause();
                          setLocalTestOverlay(null);
                          localTestVideoRef.current = null;
                          video.removeEventListener('timeupdate', checkTime);
                        }
                      };
                      video.addEventListener('timeupdate', checkTime);
                    }
                  }
                }}
              />
            )}

            <button
              onClick={() => {
                if (localTestAudioRef.current) { localTestAudioRef.current.pause(); localTestAudioRef.current = null; }
                if (localTestVideoRef.current) { localTestVideoRef.current.pause(); localTestVideoRef.current = null; }
                setLocalTestOverlay(null);
              }}
              className="text-white text-[10px] font-bold px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer backdrop-blur-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
