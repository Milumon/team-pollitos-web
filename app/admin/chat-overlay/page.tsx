'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sliders,
  Play,
  Square,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Star,
  Users,
  Eye,
  Settings2,
  Sparkles,
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

export default function AdminChatOverlayPage() {
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [listenerStatus, setListenerStatus] = useState<ListenerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<string | null>(null);
  const [recentComments, setRecentComments] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settRes, listRes] = await Promise.all([
        adminFetch('/api/admin/chat-overlay/settings'),
        adminFetch('/api/admin/tiktok-listener'),
      ]);

      const settPayload = await readApiPayload(settRes);
      if (settRes.ok) {
        setSettings(settPayload as ChatSettings);
      }

      const listPayload = await readApiPayload(listRes);
      if (listRes.ok) {
        setListenerStatus(listPayload as ListenerStatus);
      }

      const { data: comments } = await supabase
        .from('stream_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (comments) {
        setRecentComments(comments);
      }
    } catch (err) {
      console.error('Error loading chat overlay admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    // Subscribe to new comments for preview
    const channel = supabase
      .channel('admin-chat-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_comments' },
        (payload) => {
          setRecentComments((prev) => [payload.new, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const saveSettings = async (patch: Partial<ChatSettings>) => {
    if (!settings) return;
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
        setMsgFeedback('Configuración guardada y sincronizada al overlay');
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
        // Refresh status
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
    await supabase.from('stream_comments').insert({
      tiktok_user: 'pollito_tester',
      nickname: 'Pollito Tester 🐣',
      message: '¡Hola Milu! Este es un mensaje de prueba para el overlay 🎮',
      team_member_level: 5,
      is_follower: true,
      is_subscriber: true,
      is_moderator: false,
    });
  };

  if (loading || !settings) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-white">
        <RefreshCw className="animate-spin text-yellow-400 mr-3" /> Cargando panel de Chat Overlay...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-white pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-yellow-400">
            <MessageSquare className="w-6 h-6" /> Chat Overlay en Vivo (OBS)
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Filtra comentarios de TikTok Live, ajusta la posición en pantalla y gestiona el listener de la VM.
          </p>
        </div>

        {/* OBS URL Copy Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyOverlayUrl}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-sm font-medium transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-yellow-400" />}
            {copied ? '¡URL Copiada!' : 'Copiar URL para OBS'}
          </button>
        </div>
      </div>

      {msgFeedback && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm font-medium flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" /> {msgFeedback}
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: VM Listener & Chat Filters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: TikTok Listener VM Status */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
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
                  <h3 className="font-bold text-white text-base">Listener de TikTok Live (VM)</h3>
                  <p className="text-xs text-neutral-400">
                    Escuchando @milumon_gaming y @milumonxde · Auto-detección
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {listenerStatus?.running ? (
                  <button
                    onClick={() => handleListenerAction('stop')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition"
                  >
                    <Square className="w-3.5 h-3.5" /> Detener
                  </button>
                ) : (
                  <button
                    onClick={() => handleListenerAction('start')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition"
                  >
                    <Play className="w-3.5 h-3.5" /> Iniciar
                  </button>
                )}
                <button
                  onClick={loadData}
                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition"
                  title="Recargar estado"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Card: Filtros del Chat */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2 text-yellow-400">
              <ShieldCheck className="w-5 h-5" /> Filtros de Comentarios en Pantalla
            </h3>
            <p className="text-xs text-neutral-400">
              Solo los comentarios que cumplan con estas reglas se mostrarán en el overlay de OBS.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Followers Only */}
              <label className="flex items-center justify-between p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 cursor-pointer hover:border-neutral-700 transition">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-medium">Solo Seguidores</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.followers_only}
                  onChange={(e) => saveSettings({ followers_only: e.target.checked })}
                  className="w-4 h-4 accent-yellow-400 rounded cursor-pointer"
                />
              </label>

              {/* Subscribers Only */}
              <label className="flex items-center justify-between p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 cursor-pointer hover:border-neutral-700 transition">
                <div className="flex items-center gap-2.5">
                  <Star className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium">Solo Suscriptores</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.subscribers_only}
                  onChange={(e) => saveSettings({ subscribers_only: e.target.checked })}
                  className="w-4 h-4 accent-yellow-400 rounded cursor-pointer"
                />
              </label>

              {/* Moderators Only */}
              <label className="flex items-center justify-between p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 cursor-pointer hover:border-neutral-700 transition">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium">Solo Moderadores</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.moderators_only}
                  onChange={(e) => saveSettings({ moderators_only: e.target.checked })}
                  className="w-4 h-4 accent-yellow-400 rounded cursor-pointer"
                />
              </label>

              {/* Show Badges */}
              <label className="flex items-center justify-between p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 cursor-pointer hover:border-neutral-700 transition">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium">Mostrar Insignias</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.show_badges}
                  onChange={(e) => saveSettings({ show_badges: e.target.checked })}
                  className="w-4 h-4 accent-yellow-400 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Min Team Member Level */}
            <div className="p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-neutral-300">Nivel mínimo de Team Member (🐣)</span>
                <span className="font-bold text-yellow-400">
                  {settings.min_team_member_level === 0 ? 'Sin mínimo (Todos)' : `Nivel ${settings.min_team_member_level}+`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={settings.min_team_member_level}
                onChange={(e) => saveSettings({ min_team_member_level: Number(e.target.value) })}
                className="w-full accent-yellow-400 cursor-pointer"
              />
            </div>

            {/* Emoji Filter */}
            <div className="p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-2">
              <label className="block text-sm font-medium text-neutral-300">
                Filtro de Emoji en Nickname (opcional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ej: 🐣 (deja vacío para desactivar)"
                  value={settings.emoji_filter || ''}
                  onChange={(e) => saveSettings({ emoji_filter: e.target.value.trim() || null })}
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-yellow-400"
                />
                {settings.emoji_filter && (
                  <button
                    onClick={() => saveSettings({ emoji_filter: null })}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium rounded-xl transition"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card: Posición & Estilo del Overlay */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2 text-yellow-400">
              <Sliders className="w-5 h-5" /> Posición y Apariencia en Pantalla
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Posición X */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Posición X (px desde la izquierda)</span>
                  <span className="text-white font-bold">{settings.chat_position_x}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1600"
                  step="10"
                  value={settings.chat_position_x}
                  onChange={(e) => saveSettings({ chat_position_x: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>

              {/* Posición Y */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Posición Y (px desde arriba)</span>
                  <span className="text-white font-bold">{settings.chat_position_y}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="10"
                  value={settings.chat_position_y}
                  onChange={(e) => saveSettings({ chat_position_y: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>

              {/* Ancho */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Ancho del contenedor</span>
                  <span className="text-white font-bold">{settings.chat_width}px</span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="700"
                  step="10"
                  value={settings.chat_width}
                  onChange={(e) => saveSettings({ chat_width: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>

              {/* Máximo Mensajes */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Máx. mensajes visibles</span>
                  <span className="text-white font-bold">{settings.chat_max_messages}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="25"
                  value={settings.chat_max_messages}
                  onChange={(e) => saveSettings({ chat_max_messages: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>

              {/* Tamaño Fuente */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Tamaño de letra</span>
                  <span className="text-white font-bold">{settings.chat_font_size}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={settings.chat_font_size}
                  onChange={(e) => saveSettings({ chat_font_size: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>

              {/* Opacidad */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Opacidad de fondo</span>
                  <span className="text-white font-bold">{Math.round(settings.chat_opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={settings.chat_opacity}
                  onChange={(e) => saveSettings({ chat_opacity: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>
            </div>

            {/* Tema & Dirección */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-800">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Tema visual</label>
                <select
                  value={settings.chat_theme}
                  onChange={(e) => saveSettings({ chat_theme: e.target.value as any })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-yellow-400"
                >
                  <option value="glassmorphism">✨ Glassmorphism (Elegante translúcido)</option>
                  <option value="solid">⬛ Sólido Oscuro</option>
                  <option value="neon">⚡ Neón Dorado</option>
                  <option value="minimal">📏 Minimalista</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Dirección del chat</label>
                <select
                  value={settings.chat_direction}
                  onChange={(e) => saveSettings({ chat_direction: e.target.value as any })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-yellow-400"
                >
                  <option value="bottom-up">⬆️ Nuevos mensajes abajo (Clásico)</option>
                  <option value="top-down">⬇️ Nuevos mensajes arriba</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Preview & Testing */}
        <div className="space-y-6">
          {/* Card: Interactive Preview */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Eye className="w-5 h-5 text-yellow-400" /> Vista Previa
              </h3>
              <button
                onClick={sendTestComment}
                className="px-2.5 py-1 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/40 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Test Mensaje
              </button>
            </div>

            {/* Mini Screen Preview */}
            <div className="w-full h-72 bg-neutral-950/80 rounded-xl border border-neutral-800 relative overflow-hidden flex flex-col justify-end p-3">
              <div
                style={{
                  opacity: settings.chat_opacity,
                  fontSize: `${Math.max(11, settings.chat_font_size - 2)}px`,
                }}
                className="space-y-2 overflow-y-auto max-h-full"
              >
                {recentComments.length === 0 ? (
                  <div className="text-center text-neutral-600 text-xs py-8">
                    Esperando comentarios del directo...
                  </div>
                ) : (
                  recentComments.slice(0, 4).map((c) => (
                    <div
                      key={c.id || Math.random()}
                      className="p-2 rounded-lg bg-neutral-900/90 border border-white/10 text-white shadow-sm"
                    >
                      <div className="flex items-center gap-1 mb-0.5 text-[0.8em]">
                        {settings.show_badges && c.is_moderator && (
                          <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            🛡️
                          </span>
                        )}
                        {settings.show_badges && c.team_member_level > 0 && (
                          <span className="px-1 py-0.2 rounded bg-yellow-500/20 text-yellow-300 font-bold">
                            🐣
                          </span>
                        )}
                        <span className="font-bold text-yellow-300">{c.nickname}</span>
                      </div>
                      <div className="text-neutral-200 text-xs">{c.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800 text-xs text-neutral-400 space-y-1">
              <div className="font-bold text-neutral-300">💡 Instrucciones para OBS:</div>
              <div>1. Añade una fuente de <strong>Navegador</strong> (Browser Source).</div>
              <div>2. Pega la URL: <code className="text-yellow-400 font-mono">/overlay/chat</code></div>
              <div>3. Ancho: <strong>1920</strong>, Alto: <strong>1080</strong>.</div>
              <div>4. Marca <em>&quot;Apagar fuente cuando no esté visible&quot;</em>.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}