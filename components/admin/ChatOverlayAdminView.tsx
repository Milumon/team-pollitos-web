'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
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
  Eye,
  Sliders,
  Flame,
} from 'lucide-react';
import { adminFetch, readApiPayload } from '@/components/admin/adminApi';
import { supabase } from '@/lib/supabaseClient';

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
  time: string;
};

const DEFAULT_SETTINGS: ChatSettings = {
  followers_only: false,
  subscribers_only: false,
  moderators_only: false,
  min_team_member_level: 0,
  emoji_filter: null,
  chat_position_x: 30,
  chat_position_y: 450,
  chat_width: 340,
  chat_max_messages: 8,
  chat_font_size: 14,
  chat_opacity: 0.85,
  chat_direction: 'bottom-up',
  chat_theme: 'glassmorphism',
  show_badges: true,
  is_enabled: true,
};

// Canvas portrait resolution (TikTok Live standard: 720×1280)
const CANVAS_W = 720;
const CANVAS_H = 1280;

const SAMPLE_COMMENTS: SimulatedComment[] = [
  { id: '1', user: 'pollito_pro', nickname: 'Pollito Gamer 🐣', message: '¡Hola Milu! Buenas tardes', level: 12, isSub: true, time: '14:20' },
  { id: '2', user: 'steve_builder', nickname: 'Steve ⛏️', message: '¿Vamos a jugar Minecraft hoy?', level: 5, isSub: true, time: '14:21' },
  { id: '3', user: 'deivid0513', nickname: '.DURAND2492', message: '¡Mi base está protegida!', level: 18, isMod: true, isSub: true, time: '14:22' },
  { id: '4', user: 'kpop_lover', nickname: 'Milumon Fan ✨', message: '¡Que buen directo!', level: 8, isSub: false, time: '14:23' },
];

export function ChatOverlayAdminView() {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [listenerStatus, setListenerStatus] = useState<ListenerStatus>({ running: false, status: 'offline' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'controls' | 'preview'>('controls');
  const [commentsList, setCommentsList] = useState<SimulatedComment[]>(SAMPLE_COMMENTS);
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape'>('portrait');

  // Dragging state on canvas
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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
        .limit(6);

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
      .channel('admin-chat-canvas-sync')
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
              time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            ...prev.slice(0, 7),
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

  const sendTestComment = () => {
    const testNicknames = ['Pollito VIP 💎', 'GamerPro 🎮', 'MiluFan 🐣', 'Moderador 🛡️'];
    const testMessages = [
      '¡Hola a todos en el live! 🐣🔥',
      '¿Qué juego sigue después de Minecraft?',
      '¡Dejen su like y compartan el directo! ⭐',
      '¡Que buena jugada Milu! 👏',
    ];
    const randIdx = Math.floor(Math.random() * testMessages.length);
    const newSim: SimulatedComment = {
      id: String(Date.now()),
      user: `usuario_${Math.floor(Math.random() * 900 + 100)}`,
      nickname: testNicknames[randIdx],
      message: testMessages[randIdx],
      level: Math.floor(Math.random() * 20 + 1),
      isMod: randIdx === 3,
      isSub: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setCommentsList((prev) => [newSim, ...prev.slice(0, 7)]);
  };

  // Canvas Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = rect.width / (aspectRatio === 'portrait' ? CANVAS_W : CANVAS_H);
    const currentX = settings.chat_position_x * scale;
    const currentY = settings.chat_position_y * scale;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - (rect.left + currentX),
      y: e.clientY - (rect.top + currentY),
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const maxW = aspectRatio === 'portrait' ? CANVAS_W : CANVAS_H;
    const maxH = aspectRatio === 'portrait' ? CANVAS_H : CANVAS_W;
    const scale = rect.width / maxW;

    const newX = Math.round(Math.max(0, Math.min(maxW - settings.chat_width, (e.clientX - rect.left - dragOffset.x) / scale)));
    const newY = Math.round(Math.max(0, Math.min(maxH - 200, (e.clientY - rect.top - dragOffset.y) / scale)));

    setSettings((prev) => ({ ...prev, chat_position_x: newX, chat_position_y: newY }));
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      void saveSettings({ chat_position_x: settings.chat_position_x, chat_position_y: settings.chat_position_y });
    }
  };

  const visibleComments = commentsList.slice(0, settings.chat_max_messages);
  const orderedComments = settings.chat_direction === 'bottom-up' ? [...visibleComments].reverse() : visibleComments;

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-full">
      {/* Top Banner */}
      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">Stream & Diseñador OBS</span>
          <h2 className="font-display font-bold text-xl text-white mt-0.5 flex items-center gap-2">
            💬 Diseñador de Chat Overlay en Vivo
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            Ajusta la posición arrastrando en el Canvas, personaliza colores, tipografía y modera en tiempo real.
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
          ⚙️ Controles & Filtros
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            mobileTab === 'preview' ? 'bg-[#FFC200] text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          📺 Canvas Preview OBS
        </button>
      </div>

      {/* Main Split Layout: Left Controls (50%) + Right Canvas (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        
        {/* Left Side: Controls & Sliders (Lg: 6 cols) */}
        <div className={`lg:col-span-6 space-y-6 ${mobileTab === 'preview' ? 'max-lg:hidden' : ''}`}>
          
          {/* Card: TikTok Listener VM Status */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    listenerStatus?.running
                      ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse'
                      : 'bg-neutral-600'
                  }`}
                />
                <div>
                  <h3 className="font-bold text-white text-sm">Listener de TikTok Live (VM)</h3>
                  <p className="text-[11px] text-gray-400 font-semibold">
                    Escuchando @milumon_gaming y @milumonxde
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {listenerStatus?.running ? (
                  <button
                    onClick={() => handleListenerAction('stop')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" /> Detener
                  </button>
                ) : (
                  <button
                    onClick={() => handleListenerAction('start')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> Iniciar
                  </button>
                )}
                <button
                  onClick={loadData}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition cursor-pointer"
                  title="Refrescar estado"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-neutral-700/60 font-semibold">
              <span>Estado: <strong className="text-white font-mono">{listenerStatus?.status || 'Desconocido'}</strong></span>
              <span className="text-[#FFC200] font-bold">Captura activa: Comentarios & Gifts</span>
            </div>
          </div>

          {/* Card: Posición y Sliders de Pantalla */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Move className="w-4 h-4 text-[#FFC200]" /> Posición en Canvas (OBS)
              </h3>
              <span className="text-[10px] text-gray-400 font-mono">
                X: {settings.chat_position_x}px · Y: {settings.chat_position_y}px
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300 font-bold flex justify-between">
                  <span>Posición Horizontal (X)</span>
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

              <div className="space-y-1.5">
                <label className="text-xs text-gray-300 font-bold flex justify-between">
                  <span>Posición Vertical (Y)</span>
                  <span className="text-[#FFC200] font-mono">{settings.chat_position_y}px</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={CANVAS_H - 200}
                  step={10}
                  value={settings.chat_position_y}
                  onChange={(e) => setSettings({ ...settings, chat_position_y: Number(e.target.value) })}
                  onMouseUp={(e) => saveSettings({ chat_position_y: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => saveSettings({ chat_position_y: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-[#FFC200] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-300 font-bold flex justify-between">
                  <span>Ancho del Chat</span>
                  <span className="text-[#FFC200] font-mono">{settings.chat_width}px</span>
                </label>
                <input
                  type="range"
                  min={240}
                  max={550}
                  step={10}
                  value={settings.chat_width}
                  onChange={(e) => setSettings({ ...settings, chat_width: Number(e.target.value) })}
                  onMouseUp={(e) => saveSettings({ chat_width: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => saveSettings({ chat_width: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-[#FFC200] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-300 font-bold flex justify-between">
                  <span>Tamaño de Fuente</span>
                  <span className="text-[#FFC200] font-mono">{settings.chat_font_size}px</span>
                </label>
                <input
                  type="range"
                  min={12}
                  max={24}
                  step={1}
                  value={settings.chat_font_size}
                  onChange={(e) => setSettings({ ...settings, chat_font_size: Number(e.target.value) })}
                  onMouseUp={(e) => saveSettings({ chat_font_size: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => saveSettings({ chat_font_size: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-[#FFC200] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Card: Tema y Filtros Visuales */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#FFC200]" /> Estética y Temas Visuales
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
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

        {/* Right Side: Live OBS Canvas Viewport (Lg: 6 cols) */}
        <div className={`lg:col-span-6 space-y-3 ${mobileTab === 'controls' ? 'max-lg:hidden' : ''}`}>
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <span className="font-bold text-xs text-white">Lienzo en Vivo (OBS 720×1280)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sendTestComment}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#FFC200] hover:brightness-105 text-black rounded-lg text-xs font-black transition cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" /> + Simular Mensaje
              </button>
            </div>
          </div>

          {/* Canvas Interactive Frame */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative w-full aspect-[9/16] max-h-[640px] mx-auto bg-[#0e1014] rounded-2xl border-2 border-neutral-700/80 overflow-hidden select-none shadow-2xl flex flex-col justify-between"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, #171a21 0%, #0a0b0e 100%)',
            }}
          >
            {/* Background Stream Grid Placeholder */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

            {/* Top Streamer Info Overlay Hint */}
            <div className="relative z-10 p-3 flex items-center justify-between text-gray-500 text-[10px] font-mono pointer-events-none">
              <span className="bg-black/60 px-2 py-0.5 rounded border border-white/5">🔴 LIVE STREAM SIMULATOR</span>
              <span className="bg-black/60 px-2 py-0.5 rounded border border-white/5">Canvas 720×1280</span>
            </div>

            {/* Floating Chat Container (Positioned by X and Y) */}
            <div
              onMouseDown={handleMouseDown}
              className={`absolute cursor-move transition-shadow ${
                isDragging ? 'ring-2 ring-[#FFC200] shadow-[0_0_20px_rgba(255,194,0,0.5)]' : 'hover:ring-1 hover:ring-[#FFC200]/50'
              }`}
              style={{
                left: `${(settings.chat_position_x / CANVAS_W) * 100}%`,
                top: `${(settings.chat_position_y / CANVAS_H) * 100}%`,
                width: `${(settings.chat_width / CANVAS_W) * 100}%`,
              }}
            >
              {/* Drag Handle Tag */}
              <div className="flex items-center justify-between px-2 py-0.5 bg-[#FFC200] text-black text-[9px] font-black rounded-t-md opacity-80 hover:opacity-100 cursor-grab">
                <span className="flex items-center gap-1">
                  <Move className="w-2.5 h-2.5" /> Chat TikTok OBS
                </span>
                <span>{settings.chat_width}px</span>
              </div>

              {/* Chat Messages Card styled by active theme */}
              <div
                className="p-3 space-y-2 rounded-b-xl transition-all overflow-hidden"
                style={{
                  backgroundColor: settings.chat_theme === 'solid' ? '#18181b' : `rgba(20, 21, 24, ${settings.chat_opacity})`,
                  border: settings.chat_theme === 'neon' ? '1.5px solid #FFC200' : '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: settings.chat_theme === 'glassmorphism' ? 'blur(10px)' : 'none',
                  boxShadow: settings.chat_theme === 'neon' ? '0 0 15px rgba(255,194,0,0.25)' : '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                {orderedComments.map((c) => (
                  <div
                    key={c.id}
                    className="p-2 rounded-lg bg-white/5 border border-white/5 flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-display font-black text-xs text-[#FFC200] truncate">
                        @{c.user}
                      </span>
                      {settings.show_badges && c.level > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[8px] font-mono font-bold">
                          Team Pollito Lv.{c.level}
                        </span>
                      )}
                      {settings.show_badges && c.isMod && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[8px] font-bold">
                          MOD
                        </span>
                      )}
                    </div>
                    <p
                      className="text-white font-medium break-words leading-tight"
                      style={{ fontSize: `${Math.max(10, Math.round(settings.chat_font_size * 0.85))}px` }}
                    >
                      {c.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Safe Zone Indicator */}
            <div className="relative z-10 p-3 text-center text-gray-500 text-[10px] pointer-events-none border-t border-dashed border-white/5">
              <span>💡 Arrastra la caja amarilla para reposicionar el chat en OBS</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}