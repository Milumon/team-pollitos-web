'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Loader2, Image as ImageIcon, Film, Play } from 'lucide-react';

interface Session {
  access_token: string;
  user?: { id?: string };
}

interface Profile {
  id?: string;
}

interface MediaItem {
  id: string;
  name: string;
  media_type: string;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
  is_public?: boolean;
  owner_user_id?: string | null;
  cooldown_seconds?: number;
  profiles?: { roblox_user: string | null; roblox_display_name: string | null; roblox_avatar_url: string | null } | null;
}

interface Props {
  session: Session | null;
  profile: Profile | null;
}

export default function MediaGrid({}: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/sounds');
      const data = await response.json();
      if (data.sounds) {
        const mediaOnly = data.sounds.filter((s: MediaItem) => s.media_type === 'image_audio' || s.media_type === 'video');
        setMedia(mediaOnly);
      }
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void fetchMedia());
  }, [fetchMedia]);

  const handlePlay = (item: MediaItem) => {
    if (item.media_type === 'image_audio' && item.audio_url) {
      setPlayingId(item.id);
      const audio = new Audio(item.audio_url);
      audio.volume = 0.8;
      audio.onended = () => setPlayingId(null);
      void audio.play();
    } else if (item.media_type === 'video' && item.video_url) {
      setPlayingId(item.id);
      const video = document.createElement('video');
      video.src = item.video_url;
      video.volume = 0.8;
      video.onended = () => setPlayingId(null);
      void video.play();
    }
  };

  // Group by owner
  const grouped = media.reduce((acc, item) => {
    const ownerName = item.profiles?.roblox_display_name || item.profiles?.roblox_user || 'Comunidad';
    if (!acc[ownerName]) acc[ownerName] = { avatar: item.profiles?.roblox_avatar_url ?? null, items: [] };
    acc[ownerName].items.push(item);
    return acc;
  }, {} as Record<string, { avatar: string | null; items: MediaItem[] }>);

  if (loading) {
    return (
      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
        <div className="flex flex-col items-center justify-center h-32 text-center text-xs font-bold text-gray-500 uppercase animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#FFC200]" />
          Cargando media...
        </div>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
        <div className="py-8 text-center text-xs font-bold text-gray-500 border border-dashed border-[#FFC200]/45 rounded-2xl bg-black/20">
          No hay imágenes ni videos disponibles.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-4">
      {Object.entries(grouped).map(([ownerName, { avatar, items }]) => (
        <div key={ownerName}>
          <div className="flex items-center gap-2.5 mb-2 px-1">
            {avatar ? (
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-neutral-600 shrink-0">
                <Image src={avatar} alt={ownerName} fill sizes="24px" unoptimized className="w-full h-full object-cover" style={{ transform: 'scale(1.4)', transformOrigin: 'center 30%', objectPosition: 'center top' }} />
              </div>
            ) : (
              <span className="text-sm">🐣</span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{ownerName}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((item) => {
              const isPlaying = playingId === item.id;
              const isImageAudio = item.media_type === 'image_audio';
              return (
                <div
                  key={item.id}
                  className="relative h-[140px] w-full bg-[#2b2d31] hover:bg-[#20242D] border border-neutral-700/60 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-150 select-none overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,.25)] cursor-pointer"
                  onClick={() => handlePlay(item)}
                >
                  {/* Preview */}
                  {isImageAudio && item.image_url ? (
                    <Image src={item.image_url} alt={item.name} fill sizes="(max-width: 640px) 50vw, 25vw" unoptimized className="w-full h-full object-cover absolute inset-0" />
                  ) : item.video_url ? (
                    <video src={item.video_url} className="w-full h-full object-cover absolute inset-0" muted />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                       {isImageAudio ? <ImageIcon className="w-8 h-8 text-gray-600" /> : <Film className="w-8 h-8 text-gray-600" />}
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    {isPlaying ? (
                      <Loader2 className="w-8 h-8 text-[#FFC200] animate-spin" />
                    ) : (
                      <Play className="w-8 h-8 text-white/80" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-[10px] font-display font-semibold text-white truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-neutral-700 text-gray-300">
                        {isImageAudio ? 'IMG+AUD' : 'VIDEO'}
                      </span>
                      {item.is_public === false && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">🔒</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
