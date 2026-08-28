'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Loader2, Image as ImageIcon, Film } from 'lucide-react';

interface Session {
  access_token: string;
}

interface MediaSubmission {
  id: string;
  media_type: string;
  name: string;
  image_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  is_public: boolean;
  status: string;
  rejection_reason: string | null;
  suggested_cooldown_seconds: number;
  created_at: string;
}

interface Props {
  session: Session | null;
}

export default function MediaSubmissionsHistory({ session }: Props) {
  const [submissions, setSubmissions] = useState<MediaSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const response = await fetch('/api/console/media/my-submissions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (data.submissions) setSubmissions(data.submissions);
    } catch (err) {
      console.error('Error loading media submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const pending = submissions.filter(s => s.status === 'pending' || s.status === 'rejected');

  if (pending.length === 0) return null;

  return (
    <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-3">
      <div className="border-b border-neutral-700/60 pb-3">
        <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">En revisión / Rechazados</span>
        <h3 className="font-display font-semibold text-base text-white mt-0.5">Mis Envíos de Media</h3>
      </div>

      {loading ? (
        <div className="py-6 text-center text-gray-500 text-xs animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FFC200]" />
          Cargando...
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((sub) => (
            <div key={sub.id} className="flex items-start gap-3 bg-[#35373d] border border-neutral-700/40 rounded-xl p-3">
              {/* Thumbnail */}
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-neutral-800 shrink-0 flex items-center justify-center">
                {sub.media_type === 'image_audio' && sub.image_url ? (
                   <Image src={sub.image_url} alt={sub.name} fill sizes="40px" unoptimized className="w-full h-full object-cover" />
                ) : sub.video_url ? (
                  <video src={sub.video_url} className="w-full h-full object-cover" muted />
                ) : sub.media_type === 'image_audio' ? (
                   <ImageIcon className="w-5 h-5 text-gray-600" />
                ) : (
                  <Film className="w-5 h-5 text-gray-600" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-display font-semibold text-white truncate">{sub.name}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    sub.status === 'rejected'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {sub.status === 'rejected' ? '✕ Rechazado' : '⏳ Pendiente'}
                  </span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-neutral-700 text-gray-300">
                    {sub.media_type === 'image_audio' ? 'IMG+AUD' : 'VIDEO'}
                  </span>
                </div>
                {sub.rejection_reason && (
                  <p className="text-[10px] text-red-400 font-semibold mt-1 leading-relaxed">Motivo: {sub.rejection_reason}</p>
                )}
                <p className="text-[9px] text-gray-600 mt-0.5">{new Date(sub.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
