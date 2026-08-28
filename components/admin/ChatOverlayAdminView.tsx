'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Star,
  Users,
  Settings2,
  Sparkles,
  Move,
  Sliders,
  Type,
  Layout,
} from 'lucide-react';
import { adminFetch, readApiPayload } from '@/components/admin/adminApi';
import { supabase } from '@/lib/supabaseClient';

export type ChatSettings = {
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

type ListenerStatus = {
  running: boolean;
  status: string;
  uptime?: number;
};

type SimulatedComment = {
  id: string;
  user: string;
  nickname: string;
  message: string;
  level: number;
  isMod?: boolean;
  isSub?: boolean;
  isFollower?: boolean;
  time: string;
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

// Canvas portrait resolution (TikTok Live standard: 720×1280)
const CANVAS_W = 720;
const CANVAS_H = 1280;

const INITIAL_SAMPLE_COMMENTS: SimulatedComment[] = [
  { id: '1', user: 'pollito_gamer', nickname: 'Pollito Gamer 🐣', message: '¡Hola Milu! Buenas tardes', level: 12, isSub: true, isMod: false, isFollower: true, time: '14:20' },
  { id: '2', user: 'steve_builder', nickname: 'Steve_MC ⛏️', message: '¿Vamos a jugar Minecraft hoy?', level: 5, isSub: true, isMod: false, isFollower: true, time: '14:21' },
  { id: '3', user: 'deivid0513', nickname: '.DURAND2492 🛡️', message: '¡Mi base está 100% protegida!', level: 18, isMod: true, isSub: true, isFollower: true, time: '14:22' },
  { id: '4', user: 'kpop_lover', nickname: 'Milumon Fan ✨', message: '¡Que buen directo! #TeamPollito', level: 8, isSub: false, isMod: false, isFollower: true, time: '14:23' },
];

export function ChatOverlayAdminView() {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [listenerStatus, setListenerStatus] = useState<ListenerStatus>({ running: false, status: 'offline' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'controls' | 'preview'>('controls');
  const [commentsList, setCommentsList] = useState<SimulatedComment[]>(INITIAL_SAMPLE_COMMENTS);
  const [showBackgroundGuide, setShowBackgroundGuide] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<'fit' | 0.5 | 0.75 | 1>('fit');

  // Viewport & Scaling
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoScale, setAutoScale] = useState(0.48);

  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const availableW = rect.width - 32; // padding
    const availableH = rect.height - 32;

    const scaleW = availableW / CANVAS_W;
    const scaleH = availableH / CANVAS_H;
    const fitScale = Math.min(scaleW, scaleH, 1);
    setAutoScale(Math.max(0.25, fitScale));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  const effectiveScale = zoomLevel === 'fit' ? autoScale : zoomLevel;

  // Dragging state on canvas
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ mouseX: 0, mouseY: 0, chatX: 0, chatY: 0 });

  const loadData = async () => {
    try {
      const [settRes, listRes] = await Promise.allSettled([
        adminFetch('/api/admin/chat-overlay/settings'),
        adminFetch('/api/admin/tiktok-listener'),
      ]);

      if (settRes.status === 'fulfilled' && settRes.value.ok) {
        const settPayload = await readApiPayload(settRes.value);
        if (settPayload && typeof settPayload === 'object' && !('error' in settPayload)) {
          setSettings((prev) => ({ ...prev, ...(settPayload as ChatSettings) }));
        }
      }

      if (listRes.status === 'fulfilled' && listRes.value.ok) {
        const listPayload = await readApiPayload(listRes.value);
        if (listPayload && typeof listPayload === 'object' && 'running' in listPayload) {
          setListenerStatus(listPayload as ListenerStatus);
        }
      }

      const { data: comments } = await supabase
        .from('stream_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (comments && comments.length > 0) {
        setCommentsList(
          comments.map((c) => ({
            id: c.id,
            user: c.tiktok_user || 'usuario',
            nickname: c.nickname || c.tiktok_user || 'Pollito',
            message: c.message,
            level: c.team_member_level || 0,
            isMod: c.is_moderator,
            isSub: c.is_subscriber,
            isFollower: c.is_follower,
            time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }))
        );
      }
    } catch (err) {
      console.error('Error loading chat overlay admin:', err);
    }
  };

  useEffect(() => {
    void loadData();

    const channel = supabase
      .channel('admin-chat-canvas-fiel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_comments' },
        (payload) => {
          const c = payload.new;
          setCommentsList((prev) => [
            {
              id: c.id,
              user: c.tiktok_user || 'usuario',
              nickname: c.nickname || c.tiktok_user || 'Pollito',
              message: c.message,
              level: c.team_member_level || 0,
              isMod: c.is_moderator,
              isSub: c.is_subscriber,
              isFollower: c.is_follower,
              time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            ...prev.slice(0, 14),
          ]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const saveSettings = async (patch: Partial<ChatSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/chat-overlay/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setMsgFeedback('Configuración guardada y sincronizada al OBS');
        setTimeout(() => setMsgFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleListenerAction = async (action: 'start' | 'stop') => {
    setActionLoading(true);
    try {
      const res = await adminFetch('/api/admin/tiktok-listener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await readApiPayload(res);
      if (res.ok) {
        setMsgFeedback(action === 'start' ? 'Listener TikTok iniciado' : 'Listener TikTok detenido');
        setTimeout(() => setMsgFeedback(null), 3000);
        setTimeout(loadData, 2000);
      } else {
        alert(payload.error || 'Error al ejecutar acción');
      }
    } catch (err) {
      console.error('Error with listener action:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const copyOverlayUrl = () => {
    const url = `${window.location.origin}/overlay/chat`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sendTestComment = async () => {
    try {
      const res = await adminFetch('/api/admin/chat-overlay/test-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setMsgFeedback('¡Comentario de prueba enviado en vivo a OBS!');
        setTimeout(() => setMsgFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Error sending test comment:', err);
    }
  };

  // Dragging logic with true 1:1 canvas coordinates
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStartPos({
      mouseX: e.clientX,
      mouseY: e.clientY,
      chatX: settings.chat_position_x,
      chatY: settings.chat_position_y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = (e.clientX - dragStartPos.mouseX) / effectiveScale;
      const deltaY = (e.clientY - dragStartPos.mouseY) / effectiveScale;

      const newX = Math.round(Math.max(0, Math.min(CANVAS_W - settings.chat_width, dragStartPos.chatX + deltaX)));
      const newY = Math.round(Math.max(0, Math.min(CANVAS_H - 120, dragStartPos.chatY + deltaY)));

      setSettings((prev) => ({ ...prev, chat_position_x: newX, chat_position_y: newY }));
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        void saveSettings({ chat_position_x: settings.chat_position_x, chat_position_y: settings.chat_position_y });
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartPos, effectiveScale, settings.chat_width]);

  // Filter and limit messages according to settings
  const filteredComments = commentsList.filter((c) => {
    if (settings.moderators_only && !c.isMod) return false;
    if (settings.subscribers_only && !c.isSub) return false;
    if (settings.followers_only && !c.isFollower) return false;
    if (settings.min_team_member_level > 0 && c.level < settings.min_team_member_level) return false;
    return true;
  });

  const visibleComments = filteredComments.slice(0, settings.chat_max_messages);
  const orderedComments = settings.chat_direction === 'bottom-up' ? [...visibleComments].reverse() : visibleComments;

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
    <div className="space-y-6 animate-fade-in flex flex-col h-full">
      {/* Top Banner */}
      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">Stream & Diseñador OBS</span>
          <h2 className="font-display font-bold text-xl text-white mt-0.5 flex items-center gap-2">
            💬 Diseñador de Chat Overlay en Vivo (720×1280)
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            Proporciones 1:1 fidedignas a OBS. Arrastra en el lienzo, ajusta cantidad de mensajes, escalas y límites.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={copyOverlayUrl}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFC200] hover:brightness-105 text-black rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
            {copied ? '¡URL Copiada!' : 'Copiar URL para OBS'}
          </button>
        </div>
      </div>

      {msgFeedback && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" /> {msgFeedback}
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden border border-neutral-700/60 rounded-xl bg-[#2b2d31] overflow-hidden p-1">
        <button
          type="button"
          onClick={() => setMobileTab('controls')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            mobileTab === 'controls' ? 'bg-[#FFC200] text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          ⚙️ Controles & Dimensiones
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            mobileTab === 'preview' ? 'bg-[#FFC200] text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          📺 Canvas OBS 720×1280
        </button>
      </div>

      {/* Main Split Layout: Left Controls + Right Canvas OBS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        
        {/* Left Side: Controls & Sliders (5 cols) */}
        <div className={`lg:col-span-5 space-y-6 ${mobileTab === 'preview' ? 'max-lg:hidden' : ''}`}>
          
          {/* Card: Conector TikTok Live */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${listenerStatus.running ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-neutral-500'}`} />
                <h3 className="font-bold text-white text-sm">
                  📡 Conector TikTok Live
                </h3>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                listenerStatus.running ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-neutral-800 text-gray-400 border border-neutral-700'
              }`}>
                {listenerStatus.running ? '🟢 En línea (Conectado)' : '⚪ Detenido'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">
                {listenerStatus.running
                  ? 'Capturando comentarios y badges de tu live en tiempo real.'
                  : 'Inicia el conector para capturar los comentarios de tu live actual.'}
              </p>
              
              <div className="flex items-center gap-2 shrink-0">
                {listenerStatus.running ? (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleListenerAction('stop')}
                    className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5" /> Detener
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleListenerAction('start')}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" /> Iniciar Listener
                  </button>
                )}

                <button
                  type="button"
                  onClick={loadData}
                  className="p-2 bg-[#232428] hover:bg-[#2e3035] border border-neutral-700/60 rounded-xl text-gray-400 hover:text-white transition cursor-pointer"
                  title="Actualizar estado"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Card: Dimensiones y Cantidad de Mensajes */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#FFC200]" /> Dimensiones y Cantidad de Mensajes
              </h3>
              <span className="text-[10px] text-gray-400 font-mono">
                {settings.chat_width}px × Auto
              </span>
            </div>

            {/* Slider 1: Cantidad Máxima de Mensajes Visibles */}
            <div className="p-3.5 bg-[#232428] border border-neutral-700/60 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-white flex items-center gap-1.5">
                  <Layout className="w-3.5 h-3.5 text-[#FFC200]" /> Mensajes Visibles en Pantalla
                </span>
                <span className="px-2 py-0.5 bg-[#FFC200]/20 text-[#FFC200] rounded font-mono font-black text-xs">
                  {settings.chat_max_messages} mensajes
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={settings.chat_max_messages}
                onChange={(e) => setSettings({ ...settings, chat_max_messages: Number(e.target.value) })}
                onMouseUp={(e) => saveSettings({ chat_max_messages: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => saveSettings({ chat_max_messages: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-[#FFC200] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>1 (Único)</span>
                <span>5 (Estándar)</span>
                <span>15 (Historial largo)</span>
              </div>
            </div>

            {/* Slider 2: Ancho del Chat */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-bold flex justify-between">
                <span>Ancho de la Caja (Width)</span>
                <span className="text-[#FFC200] font-mono">{settings.chat_width}px</span>
              </label>
              <input
                type="range"
                min={200}
                max={680}
                step={10}
                value={settings.chat_width}
                onChange={(e) => setSettings({ ...settings, chat_width: Number(e.target.value) })}
                onMouseUp={(e) => saveSettings({ chat_width: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => saveSettings({ chat_width: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-[#FFC200] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                <span>200px (Columna estrecha)</span>
                <span>720px (Pantalla completa)</span>
              </div>
            </div>

            {/* Slider 3: Tamaño de Fuente / Escala de Texto */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-bold flex justify-between">
                <span className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-[#FFC200]" /> Tamaño de Fuente (Font Size)</span>
                <span className="text-[#FFC200] font-mono">{settings.chat_font_size}px</span>
              </label>
              <input
                type="range"
                min={10}
                max={30}
                step={1}
                value={settings.chat_font_size}
                onChange={(e) => setSettings({ ...settings, chat_font_size: Number(e.target.value) })}
                onMouseUp={(e) => saveSettings({ chat_font_size: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => saveSettings({ chat_font_size: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-[#FFC200] cursor-pointer"
              />
            </div>

            {/* Slider 4: Opacidad de Fondo */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-bold flex justify-between">
                <span>Opacidad de la Caja</span>
                <span className="text-[#FFC200] font-mono">{Math.round(settings.chat_opacity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={settings.chat_opacity}
                onChange={(e) => setSettings({ ...settings, chat_opacity: Number(e.target.value) })}
                onMouseUp={(e) => saveSettings({ chat_opacity: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => saveSettings({ chat_opacity: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-[#FFC200] cursor-pointer"
              />
            </div>

            {/* Slider 5: Posición X e Y manual */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-700/60">
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 font-bold flex justify-between">
                  <span>Pos. X</span>
                  <span className="text-[#FFC200] font-mono">{settings.chat_position_x}px</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={CANVAS_W - settings.chat_width}
                  step={5}
                  value={settings.chat_position_x}
                  onChange={(e) => setSettings({ ...settings, chat_position_x: Number(e.target.value) })}
                  onMouseUp={(e) => saveSettings({ chat_position_x: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => saveSettings({ chat_position_x: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-[#FFC200] cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 font-bold flex justify-between">
                  <span>Pos. Y</span>
                  <span className="text-[#FFC200] font-mono">{settings.chat_position_y}px</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={CANVAS_H - 120}
                  step={10}
                  value={settings.chat_position_y}
                  onChange={(e) => setSettings({ ...settings, chat_position_y: Number(e.target.value) })}
                  onMouseUp={(e) => saveSettings({ chat_position_y: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => saveSettings({ chat_position_y: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-[#FFC200] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Card: Dirección del flujo y Temas */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#FFC200]" /> Dirección y Tema Visual
            </h3>

            {/* Dirección */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => saveSettings({ chat_direction: 'bottom-up' })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  settings.chat_direction === 'bottom-up'
                    ? 'border-[#FFC200] bg-[#FFC200]/15 text-[#FFC200]'
                    : 'border-neutral-700/60 bg-[#232428] text-gray-400 hover:border-neutral-600'
                }`}
              >
                Abajo hacia Arriba ↑
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">Estilo TikTok / Twitch</div>
              </button>
              <button
                type="button"
                onClick={() => saveSettings({ chat_direction: 'top-down' })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  settings.chat_direction === 'top-down'
                    ? 'border-[#FFC200] bg-[#FFC200]/15 text-[#FFC200]'
                    : 'border-neutral-700/60 bg-[#232428] text-gray-400 hover:border-neutral-600'
                }`}
              >
                Arriba hacia Abajo ↓
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">Lectura clásica</div>
              </button>
            </div>

            {/* Temas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {[
                { id: 'glassmorphism', label: 'Glassmorphism', desc: 'Vidrio' },
                { id: 'solid', label: 'Sólido', desc: 'Oscuro' },
                { id: 'minimal', label: 'Minimal', desc: 'Limpio' },
                { id: 'neon', label: 'Neón Oro', desc: 'Dorado' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => saveSettings({ chat_theme: t.id as any })}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    settings.chat_theme === t.id
                      ? 'border-[#FFC200] bg-[#FFC200]/15 text-[#FFC200]'
                      : 'border-neutral-700/60 bg-[#232428] text-gray-400 hover:border-neutral-600'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{t.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center justify-between p-3 bg-[#232428] border border-neutral-700/60 rounded-xl cursor-pointer">
                <span className="text-xs font-bold text-white">Solo Suscriptores</span>
                <input
                  type="checkbox"
                  checked={settings.subscribers_only}
                  onChange={(e) => saveSettings({ subscribers_only: e.target.checked })}
                  className="w-4 h-4 accent-[#FFC200] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#232428] border border-neutral-700/60 rounded-xl cursor-pointer">
                <span className="text-xs font-bold text-white">Mostrar Insignias</span>
                <input
                  type="checkbox"
                  checked={settings.show_badges}
                  onChange={(e) => saveSettings({ show_badges: e.target.checked })}
                  className="w-4 h-4 accent-[#FFC200] rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Side: Faithful 720×1280 OBS Canvas Viewport (7 cols) */}
        <div className={`lg:col-span-7 space-y-3 ${mobileTab === 'controls' ? 'max-lg:hidden' : ''}`}>
          
          {/* Canvas Toolbar */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <div>
                <div className="font-bold text-xs text-white">Lienzo Nativo OBS (720×1280)</div>
                <div className="text-[10px] text-gray-400 font-mono">Escala: {Math.round(effectiveScale * 100)}%</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBackgroundGuide(!showBackgroundGuide)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                  showBackgroundGuide
                    ? 'bg-[#FFC200]/15 text-[#FFC200] border-[#FFC200]/40'
                    : 'bg-neutral-800 text-gray-400 border-neutral-700'
                }`}
              >
                🖼️ Guía Stream: {showBackgroundGuide ? 'ON' : 'OFF'}
              </button>

              <div className="flex bg-neutral-800 p-0.5 rounded-lg border border-neutral-700">
                {(['fit', 0.5, 0.75, 1] as const).map((z) => (
                  <button
                    key={String(z)}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      zoomLevel === z ? 'bg-[#FFC200] text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {z === 'fit' ? 'Fit' : `${Math.round(z * 100)}%`}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={sendTestComment}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#FFC200] hover:brightness-105 text-black rounded-lg text-xs font-black transition cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" /> + Simular
              </button>
            </div>
          </div>

          {/* Canvas Viewport Container with Resize and Scroll */}
          <div
            ref={containerRef}
            className="w-full bg-[#0a0b0e] rounded-2xl border-2 border-neutral-700/80 overflow-auto p-4 flex items-start justify-center shadow-2xl relative select-none"
            style={{
              minHeight: '620px',
              maxHeight: '820px',
            }}
          >
            {/* Real 720×1280 Scaled Canvas */}
            <div
              style={{
                width: `${CANVAS_W}px`,
                height: `${CANVAS_H}px`,
                transform: `scale(${effectiveScale})`,
                transformOrigin: 'top center',
                marginBottom: `${-(CANVAS_H * (1 - effectiveScale))}px`,
                marginRight: `${-(CANVAS_W * (1 - effectiveScale)) / 2}px`,
                marginLeft: `${-(CANVAS_W * (1 - effectiveScale)) / 2}px`,
              }}
              className="relative shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-2xl"
            >
              {/* Background Layer: Game Simulation or Dark Grid */}
              {showBackgroundGuide ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: 'url("/images/916 vertical layout.png")'
                  }}
                >
                  <div className="absolute inset-0 bg-black/40" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-[#12141a] bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]" />
              )}

              {/* OBS Overlay Guide Watermarks */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white/50 text-xs font-mono font-bold pointer-events-none z-10">
                <span className="bg-black/60 px-3 py-1 rounded-md border border-white/10">🔴 LIVE TIKTOK (720×1280)</span>
                <span className="bg-black/60 px-3 py-1 rounded-md border border-white/10">{settings.chat_max_messages} MENSAJES MÁX</span>
              </div>

              {/* Floating Chat Container (Positioned in exact 720×1280 space) */}
              <div
                style={{
                  position: 'absolute',
                  left: `${settings.chat_position_x}px`,
                  top: `${settings.chat_position_y}px`,
                  width: `${settings.chat_width}px`,
                  opacity: settings.chat_opacity,
                  fontSize: `${settings.chat_font_size}px`,
                }}
                className={`flex flex-col gap-2 transition-shadow select-none ${
                  isDragging ? 'ring-4 ring-[#FFC200] shadow-[0_0_30px_rgba(255,194,0,0.8)] z-30' : 'hover:ring-2 hover:ring-[#FFC200]/70 z-20'
                }`}
              >
                {/* Drag Handle Bar */}
                <div
                  onMouseDown={handleMouseDown}
                  className="flex items-center justify-between px-3 py-1.5 bg-[#FFC200] text-black text-[11px] font-black rounded-t-xl cursor-grab active:cursor-grabbing shadow-md"
                >
                  <span className="flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5" /> Chat TikTok OBS
                  </span>
                  <span>{settings.chat_width}px · ({settings.chat_position_x}, {settings.chat_position_y})</span>
                </div>

                {/* Render Exactly the Allowed Number of Messages */}
                {orderedComments.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl transition-all duration-300 ${getThemeClass()}`}
                  >
                    {/* Header: Badges + Nickname */}
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {settings.show_badges && (
                        <div className="flex items-center gap-1 text-[0.8em]">
                          {item.isMod && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-bold border border-blue-400/40">
                              🛡️ MOD
                            </span>
                          )}
                          {item.isSub && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 font-bold border border-purple-400/40">
                              ⭐ SUB
                            </span>
                          )}
                          {item.level > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400/30 text-amber-300 font-bold border border-amber-400/40">
                              🐣 Lv.{item.level}
                            </span>
                          )}
                        </div>
                      )}

                      <span className="font-bold text-[#FFC200] drop-shadow-sm tracking-wide">
                        {item.nickname}
                      </span>
                      <span className="text-white/40 text-[0.75em]">
                        @{item.user}
                      </span>
                    </div>

                    {/* Message Body */}
                    <div className="leading-snug break-words font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {item.message}
                    </div>
                  </div>
                ))}

                {orderedComments.length === 0 && (
                  <div className="p-4 rounded-xl bg-black/60 border border-white/10 text-center text-xs text-gray-400">
                    Sin mensajes visibles con los filtros actuales.
                  </div>
                )}
              </div>

              {/* Bottom Safe Zone Indicator */}
              <div className="absolute bottom-4 left-4 right-4 text-center text-white/50 text-[11px] pointer-events-none bg-black/60 px-3 py-1.5 rounded-lg border border-white/10">
                💡 Arrastra la barra amarilla del chat para reubicarlo milimétricamente en OBS
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
