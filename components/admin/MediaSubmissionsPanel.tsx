'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Loader2, Image as ImageIcon, Film, Volume2, Check, X } from 'lucide-react';

interface MediaSubmission {
  id: string;
  submitted_by_user_id: string;
  media_type: string;
  name: string;
  image_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  suggested_cooldown_seconds: number;
  is_public: boolean;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  profiles?: { roblox_user: string | null; roblox_display_name: string | null; roblox_avatar_url: string | null } | null;
}

interface Props {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  token: string;
}

const TYPE_LABELS: Record<string, string> = {
  audio: '🔊 Audio',
  image_audio: '🖼️+🔊 IMG+Audio',
  video: '🎬 Video',
  image: '🖼️ Imagen',
};

const TYPE_COLORS: Record<string, string> = {
  audio: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  image_audio: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  video: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  image: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function MediaSubmissionsPanel({ apiFetch }: Props) {
  const [submissions, setSubmissions] = useState<MediaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/media/submissions?status=${statusFilter}`);
      const data = await res.json();
      if (data.submissions) setSubmissions(data.submissions);
    } catch (err) {
      console.error('Error loading media submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, apiFetch]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const res = await apiFetch(`/api/admin/media/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Error al aprobar');
      setSubmissions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      const res = await apiFetch(`/api/admin/media/submissions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason[id] || null }),
      });
      if (!res.ok) throw new Error('Error al rechazar');
      setSubmissions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const filtered = typeFilter === 'all' ? submissions : submissions.filter(s => s.media_type === typeFilter);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display font-bold text-lg text-white">Media de Usuarios</h2>
        <div className="flex gap-1.5">
          {(['pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                statusFilter === status
                  ? 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/30'
                  : 'bg-neutral-800 text-gray-400 border-neutral-700/60 hover:text-white'
              }`}
            >
              {status === 'pending' ? '⏳ Pendientes' : status === 'approved' ? '✅ Aprobados' : '❌ Rechazados'}
            </button>
          ))}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          ['all', '📋 Todos'],
          ['audio', '🔊 Audio'],
          ['image_audio', '🖼️+🔊 IMG+Audio'],
          ['video', '🎬 Video'],
          ['image', '🖼️ Imagen'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
              typeFilter === key
                ? 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/30'
                : 'bg-neutral-800 text-gray-500 border-neutral-700/60 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 text-xs animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FFC200]" />
          Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs font-bold text-gray-500 border border-dashed border-neutral-700/60 rounded-2xl bg-black/20">
          No hay envíos {statusFilter === 'pending' ? 'pendientes' : statusFilter === 'approved' ? 'aprobados' : 'rechazados'}{typeFilter !== 'all' ? ` de tipo ${TYPE_LABELS[typeFilter] || typeFilter}` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <div key={sub.id} className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,.25)]">
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-800 shrink-0 flex items-center justify-center">
                  {sub.media_type === 'image' && sub.image_url ? (
                    <Image src={sub.image_url} alt="" fill sizes="64px" unoptimized className="w-full h-full object-cover" />
                  ) : sub.media_type === 'image_audio' && sub.image_url ? (
                    <Image src={sub.image_url} alt="" fill sizes="64px" unoptimized className="w-full h-full object-cover" />
                  ) : sub.media_type === 'video' && sub.video_url ? (
                    <video src={sub.video_url} className="w-full h-full object-cover" muted />
                  ) : sub.media_type === 'audio' ? (
                    <Volume2 className="w-6 h-6 text-gray-600" />
                  ) : sub.media_type === 'image_audio' ? (
                     <ImageIcon className="w-6 h-6 text-gray-600" />
                  ) : (
                    <Film className="w-6 h-6 text-gray-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-display font-semibold text-white">{sub.name}</p>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[sub.media_type] || 'bg-neutral-700 text-gray-300'}`}>
                      {TYPE_LABELS[sub.media_type] || sub.media_type}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      sub.is_public
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {sub.is_public ? '🌐 Público' : '🔒 Privado'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    por {sub.profiles?.roblox_display_name || sub.profiles?.roblox_user || 'Desconocido'} · {new Date(sub.created_at).toLocaleDateString('es-AR')}
                  </p>

                  {/* Audio preview */}
                  {(sub.media_type === 'image_audio' || sub.media_type === 'audio') && sub.audio_url && (
                    <audio controls src={sub.audio_url} className="mt-2 h-8 w-full max-w-xs" />
                  )}
                  {/* Video preview */}
                  {sub.media_type === 'video' && sub.video_url && (
                    <video controls src={sub.video_url} className="mt-2 rounded-lg max-w-xs max-h-32" />
                  )}

                  {/* Actions — only for pending */}
                  {sub.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => void handleApprove(sub.id)}
                        disabled={processing === sub.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {processing === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Aprobar
                      </button>
                      <input
                        type="text"
                        value={rejectReason[sub.id] || ''}
                        onChange={(e) => setRejectReason(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        placeholder="Motivo (opcional)"
                        className="flex-1 bg-[#35373d] border border-neutral-700/60 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-red-500/50 max-w-[200px]"
                      />
                      <button
                        onClick={() => void handleReject(sub.id)}
                        disabled={processing === sub.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {processing === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
