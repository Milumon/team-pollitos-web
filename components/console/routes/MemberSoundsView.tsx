'use client';

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Loader2, Volume2 } from 'lucide-react';
import MediaSubmissionsHistory from '@/components/console/MediaSubmissionsHistory';
import MediaUploadForm from '@/components/console/MediaUploadForm';
import { soundManager } from '@/lib/sound';

type Sound = {
  id: string;
  name: string;
  url?: string;
  cooldown_seconds?: number;
  is_public?: boolean;
  owner_user_id?: string | null;
  media_type?: string;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
  trim_start?: number | null;
  trim_end?: number | null;
  profiles?: {
    roblox_user: string | null;
    roblox_display_name: string | null;
    roblox_avatar_url: string | null;
  } | null;
};

type MySubmission = {
  id: string;
  name: string;
  url: string;
  file_path: string;
  is_public: boolean;
  suggested_cooldown_seconds: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
};

type StreamEvent = {
  id: string;
  type: 'sound' | 'tts' | 'animation' | 'audio' | 'image' | 'image_audio' | 'video';
  content: string;
  sender_roblox_user: string | null;
  created_at: string;
};

type StreamSettings = {
  personal_cooldown_seconds: number;
  overlay_media_repeat_count?: number;
};

type LocalTestOverlay = {
  type: 'image' | 'image_audio' | 'video' | 'audio';
  name: string;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
  trim_start?: number | null;
  trim_end?: number | null;
};

type EditingSound = {
  id: string;
  name: string;
  url: string;
  is_public: boolean;
  cooldown_seconds: number;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  trim_start?: number | null;
  trim_end?: number | null;
};

type ProfilePermissions = {
  perm_upload_images?: boolean;
  perm_upload_videos?: boolean;
  perm_upload_audio?: boolean;
  perm_tts_text?: boolean;
  perm_tts_record?: boolean;
};

export type MemberSoundsViewProps = {
  panelMode: boolean;
  displayedSoundType: 'audios' | 'multimedia' | 'videos';
  streamSettings: StreamSettings | null;
  session: Session;
  profile: ProfilePermissions | null;
  sounds: Sound[];
  loadingSounds: boolean;
  soundCooldown: number;
  soundCooldownPercent: number;
  isLocalTestMode: boolean;
  isMuted: boolean | undefined;
  triggeringId: string | null;
  soundDurations: Record<string, number>;
  mySubmissions: MySubmission[];
  recentEvents: StreamEvent[];
  customImageMessage: string;
  sendMessageEnabled: boolean;
  sendRepeatEnabled: boolean;
  localTestAudioRef: MutableRefObject<HTMLAudioElement | null>;
  localTestVideoRef: MutableRefObject<HTMLVideoElement | null>;
  setSoundboardSubTab: (value: 'audios' | 'multimedia' | 'videos') => void;
  setCustomImageMessage: (value: string) => void;
  setSendMessageEnabled: (value: boolean) => void;
  setSendRepeatEnabled: (value: boolean) => void;
  setError: (value: string | null) => void;
  setSuccess: (value: string | null) => void;
  setLocalTestMode: (value: boolean) => void;
  setLocalTestOverlay: Dispatch<SetStateAction<LocalTestOverlay | null>>;
  setEditingSound: Dispatch<SetStateAction<EditingSound | null>>;
  setEditSoundName: (value: string) => void;
  setEditSoundCooldown: (value: string) => void;
  setEditSoundPublic: (value: boolean) => void;
  setEditingSource: (value: 'soundboard' | 'submission') => void;
  setEditingSoundAudioEnabled: (value: boolean) => void;
  setEditingSoundAudioFile: (value: File | null) => void;
  setEditingSoundAudioTrim: (value: { start: number; end: number } | null) => void;
  setEditingSoundAudioError: (value: string) => void;
  setEditVideoTrimStart: (value: number) => void;
  setEditVideoTrimEnd: (value: number) => void;
  setEditVideoDuration: (value: number) => void;
  fetchSounds: () => Promise<void>;
  fetchLeaderboards: (session: Session) => Promise<void>;
  fetchMedia: () => Promise<void>;
  loadMediaSubmissions: (session: Session) => Promise<void>;
  triggerEvent: (type: 'image_audio' | 'video' | 'image' | 'audio', content: string, bypassConfirm: boolean, mediaUrls?: { image_url?: string; audio_url?: string; video_url?: string }) => void;
};

const getSoundColor = (soundId: string) => {
  switch (soundId) {
    case 'risa': return { text: 'text-[#FFC200]', badge: 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/20' };
    case 'bocina': return { text: 'text-red-500', badge: 'bg-red-500/10 text-red-400 border-red-500/20' };
    case 'grito': return { text: 'text-pink-500', badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20' };
    case 'aplausos': return { text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'suspenso': return { text: 'text-fuchsia-400', badge: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' };
    case 'sorpresa': return { text: 'text-orange-500', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
    case 'fallo': return { text: 'text-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    case 'victoria': return { text: 'text-sky-400', badge: 'bg-sky-500/10 text-sky-400 border-sky-400/20' };
    default: return { text: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
  }
};

export function MemberSoundsView({
  panelMode, displayedSoundType, streamSettings, session, profile, sounds, loadingSounds,
  soundCooldown, soundCooldownPercent, isLocalTestMode, isMuted, triggeringId, soundDurations,
  mySubmissions, recentEvents, customImageMessage, sendMessageEnabled, sendRepeatEnabled,
  setSoundboardSubTab, setCustomImageMessage, setSendMessageEnabled, setSendRepeatEnabled,
  setError, setSuccess, setLocalTestMode, setLocalTestOverlay, localTestAudioRef, localTestVideoRef,
  setEditingSound, setEditSoundName, setEditSoundCooldown, setEditSoundPublic, setEditingSource,
  setEditingSoundAudioEnabled, setEditingSoundAudioFile, setEditingSoundAudioTrim, setEditingSoundAudioError,
  setEditVideoTrimStart, setEditVideoTrimEnd, setEditVideoDuration, fetchSounds, fetchLeaderboards,
  fetchMedia, loadMediaSubmissions, triggerEvent,
}: MemberSoundsViewProps) {
  return (
    <motion.div key="sounds-tab" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }} className="absolute inset-0 flex flex-col overflow-hidden text-left">
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin">
        <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Volume2 className="w-5 h-5 text-gray-400" /><h2 className="font-display font-bold text-base md:text-lg text-white">Banco</h2></div>
            <span className="text-[10px] bg-neutral-800 rounded-lg px-2 py-0.5 font-mono text-gray-500">Cooldown: {streamSettings ? `${Math.min(60, streamSettings.personal_cooldown_seconds)}s` : '60s'}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {([{ id: 'audios' as const, label: '🔊 Audios' }, { id: 'multimedia' as const, label: '🖼️ Imágenes' }, { id: 'videos' as const, label: '🎬 Videos' }]).map((tab) => (
              <Link key={tab.id} href={panelMode ? `/panel/sonidos?tipo=${tab.id}` : '/console'} aria-current={displayedSoundType === tab.id ? 'page' : undefined} onClick={(event) => { soundManager.playPop(); if (!panelMode) { event.preventDefault(); setSoundboardSubTab(tab.id); } }} className={`px-3 py-1.5 rounded-full text-[11px] font-display font-semibold border transition-all cursor-pointer ${displayedSoundType === tab.id ? 'bg-[#FFC200] text-black border-[#FFC200] shadow-[2px_2px_0_0_#000]' : 'bg-[#35373d] text-gray-400 border-neutral-700/60 hover:text-white'}`}>{tab.label}</Link>
            ))}
          </div>
        </div>

        <MediaUploadForm session={session} onSuccess={() => { void fetchSounds(); void fetchLeaderboards(session); void fetchMedia(); void loadMediaSubmissions(session); }} permissions={profile ? { perm_upload_images: profile.perm_upload_images as boolean, perm_upload_videos: profile.perm_upload_videos as boolean, perm_upload_audio: profile.perm_upload_audio as boolean, perm_tts_text: profile.perm_tts_text as boolean, perm_tts_record: profile.perm_tts_record as boolean } : undefined} />

        {displayedSoundType === 'multimedia' && (
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-3 sm:p-4 shadow-[0_4px_12px_rgba(0,0,0,.25)]"><div className="flex items-center gap-3 flex-wrap"><div className="flex-1 min-w-[180px]"><input type="text" value={customImageMessage} onChange={(e) => setCustomImageMessage(e.target.value)} placeholder="Mensaje opcional para imagen..." maxLength={120} className="w-full bg-neutral-900 border border-neutral-700/60 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 font-medium focus:outline-none focus:border-[#FFC200]/60 transition-colors" /></div><label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0"><input type="checkbox" checked={sendMessageEnabled} onChange={(e) => setSendMessageEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-[#FFC200] cursor-pointer" /><span className="text-[10px] text-gray-400 font-medium">Enviar mensaje</span></label>{false && (streamSettings?.overlay_media_repeat_count ?? 1) > 1 && (<label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0"><input type="checkbox" checked={sendRepeatEnabled} onChange={(e) => setSendRepeatEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-[#FFC200] cursor-pointer" /><span className="text-[10px] text-gray-400 font-medium">🔥 Repeat ({streamSettings?.overlay_media_repeat_count ?? 1}x)</span></label>)}</div></div>
        )}

        <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-3 sm:p-4 md:p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-col overflow-hidden min-h-[400px]"><div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {loadingSounds ? <div className="flex flex-col items-center justify-center h-48 text-center text-xs font-bold text-gray-500 uppercase animate-pulse"><Loader2 className="w-7 h-7 animate-spin mb-2 text-[#FFC200]" />Cargando contenido...</div> : (() => {
            const filteredSounds = sounds.filter((s) => displayedSoundType === 'audios' ? !s.media_type || s.media_type === 'audio' : displayedSoundType === 'multimedia' ? s.media_type === 'image_audio' || s.media_type === 'image' : s.media_type === 'video');
            if (filteredSounds.length === 0) return <div className="py-12 text-center text-xs font-bold text-gray-500 border border-dashed border-[#FFC200]/45 rounded-2xl bg-black/20">{displayedSoundType === 'audios' && 'No hay audios disponibles en este momento.'}{displayedSoundType === 'multimedia' && 'No hay imágenes disponibles en este momento.'}{displayedSoundType === 'videos' && 'No hay videos disponibles en este momento.'}</div>;
             const grouped = filteredSounds.reduce((acc, sound) => { const ownerName = sound.profiles?.roblox_display_name || sound.profiles?.roblox_user || 'Comunidad'; if (!acc[ownerName]) acc[ownerName] = { avatar: sound.profiles?.roblox_avatar_url ?? null, sounds: [] }; acc[ownerName].sounds.push(sound); return acc; }, {} as Record<string, { avatar: string | null; sounds: Sound[] }>);
             // eslint-disable-next-line @next/next/no-img-element
            return <div className="space-y-4 p-1">{Object.entries(grouped).map(([ownerName, { avatar, sounds: ownerSounds }]) => <div key={ownerName}><div className="flex items-center gap-2.5 mb-2 px-1">{avatar ? <div className="w-6 h-6 rounded-full overflow-hidden border border-neutral-600 shrink-0"><img src={avatar} alt={ownerName} className="w-full h-full object-cover" style={{ transform: 'scale(1.4)', transformOrigin: 'center 30%', objectPosition: 'center top' }} /></div> : <span className="text-sm">🐣</span>}<span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{ownerName}</span></div><div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-3">{ownerSounds.map((sound) => {
              const isCooldown = soundCooldown > 0;
              // These refs are read only in the click handler, never during render.
              // eslint-disable-next-line react-hooks/refs
              const handleSoundClick = () => { if (!isLocalTestMode && isCooldown) { setError(`Esperá el cooldown de sonidos (${soundCooldown}s)`); setTimeout(() => setError(null), 3000); return; } if (isLocalTestMode) { if (localTestAudioRef.current) { localTestAudioRef.current.pause(); localTestAudioRef.current = null; } if (localTestVideoRef.current) { localTestVideoRef.current.pause(); localTestVideoRef.current = null; } if (sound.media_type === 'image' && sound.image_url) { setLocalTestOverlay({ type: 'image', name: sound.name, image_url: sound.image_url }); setTimeout(() => setLocalTestOverlay(null), 3000); } else if (sound.media_type === 'image_audio' && sound.image_url) { const audioUrl = sound.audio_url || sound.url; setLocalTestOverlay({ type: 'image_audio', name: sound.name, image_url: sound.image_url, audio_url: audioUrl }); if (audioUrl) { const audio = new Audio(audioUrl); localTestAudioRef.current = audio; audio.volume = 0.5; audio.onended = () => { setLocalTestOverlay(null); localTestAudioRef.current = null; }; void audio.play(); } else setTimeout(() => setLocalTestOverlay(null), 3000); } else if (sound.media_type === 'video' && sound.video_url) setLocalTestOverlay({ type: 'video', name: sound.name, video_url: sound.video_url, trim_start: sound.trim_start, trim_end: sound.trim_end }); else if (sound.url) { soundManager.playHatch(); try { const audio = new Audio(sound.url); audio.volume = 0.5; void audio.play(); } catch (e) { console.warn('Fallback audio play failure', e); } setSuccess(`Escuchando localmente: ${sound.name} 🎧`); setTimeout(() => setSuccess(null), 3000); } } else if (sound.media_type === 'image_audio') void triggerEvent('image_audio', sound.name, false, { image_url: sound.image_url, audio_url: sound.audio_url || sound.url }); else if (sound.media_type === 'video') void triggerEvent('video', sound.name, false, { video_url: sound.video_url }); else if (sound.media_type === 'image') void triggerEvent('image', sound.name, false, { image_url: sound.image_url }); else void triggerEvent('audio', sound.id, false, { audio_url: sound.url }); };
              const soundStyles = getSoundColor(sound.id); const duration = soundDurations[sound.id]; const isOwner = session.user?.id === sound.owner_user_id;
              return <div key={sound.id} onClick={handleSoundClick} className={`relative h-[110px] sm:h-[135px] md:h-[140px] w-full rounded-xl sm:rounded-2xl flex flex-col justify-between items-center text-center px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all duration-150 select-none overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,.25)] cursor-pointer ${sound.image_url ? 'bg-cover bg-center' : 'bg-[#2b2d31] hover:bg-[#20242D] border border-neutral-700/60'} ${!isLocalTestMode && (isCooldown || triggeringId !== null || isMuted) ? 'opacity-50' : ''}`} style={sound.image_url ? { backgroundImage: `url(${sound.image_url})` } : undefined}>
                {sound.image_url && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 pointer-events-none" />}{isCooldown && !isLocalTestMode && <motion.div initial={{ width: '100%' }} animate={{ width: `${soundCooldownPercent}%` }} transition={{ duration: 1, ease: 'linear' }} className="absolute inset-x-0 bottom-0 h-1.5 bg-red-500 pointer-events-none z-20" />}
                <div className="flex items-center justify-between w-full relative z-10 pt-1">{!sound.image_url ? <span className="text-lg">{sound.media_type === 'video' ? '🎬' : sound.media_type === 'image' ? '🖼️' : '🔊'}</span> : <span /> }<div className="flex items-center gap-1.5">{isOwner && <button onClick={(e) => { e.stopPropagation(); setEditingSound({ id: sound.id, name: sound.name, url: sound.url || '', is_public: sound.is_public ?? true, cooldown_seconds: sound.cooldown_seconds ?? 0, media_type: sound.media_type, image_url: sound.image_url, video_url: sound.video_url, audio_url: sound.audio_url, trim_start: sound.trim_start, trim_end: sound.trim_end }); setEditSoundName(sound.name); setEditSoundCooldown(String(sound.cooldown_seconds ?? 0)); setEditSoundPublic(sound.is_public ?? true); setEditingSource('soundboard'); setEditingSoundAudioEnabled(false); setEditingSoundAudioFile(null); setEditingSoundAudioTrim(null); setEditingSoundAudioError(''); setEditVideoTrimStart(sound.trim_start ?? 0); setEditVideoTrimEnd(sound.trim_end ?? 0); setEditVideoDuration(0); }} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-neutral-700/80 text-gray-400 hover:text-white border border-neutral-600 cursor-pointer backdrop-blur-sm">✏️</button>}{sound.image_url && sound.media_type === 'image_audio' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white border border-white/20 backdrop-blur-sm">🔊</span>}<span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-2xl border backdrop-blur-sm ${isCooldown && !isLocalTestMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : sound.image_url ? 'bg-black/50 text-white border-white/20' : soundStyles.badge}`}>{isCooldown && !isLocalTestMode ? `${soundCooldown}s` : 'LISTO'}</span></div></div>
                <span className={`block truncate font-display font-semibold text-[10px] sm:text-xs md:text-sm relative z-10 leading-none w-full ${sound.image_url ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : soundStyles.text}`} title={sound.name}>{sound.name}</span>
                <div className="flex items-center justify-between w-full relative z-10 pb-0.5"><span className={`text-[9px] font-bold ${sound.image_url ? 'text-white/70' : 'text-gray-500'}`}>{duration ? `${Math.ceil(duration)}s` : '...'}{sound.cooldown_seconds ? ` · CD: ${sound.cooldown_seconds}s` : ''}</span>{!isLocalTestMode && isCooldown ? <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">⏳ {soundCooldown}s</span> : <button onClick={(e) => { e.stopPropagation(); if (!isLocalTestMode && !isCooldown && !isMuted) { if (sound.media_type === 'image_audio') void triggerEvent('image_audio', sound.name, false, { image_url: sound.image_url, audio_url: sound.audio_url || sound.url }); else if (sound.media_type === 'video') void triggerEvent('video', sound.name, false, { video_url: sound.video_url }); else if (sound.media_type === 'image') void triggerEvent('image', sound.name, false, { image_url: sound.image_url }); else void triggerEvent('audio', sound.id, false, { audio_url: sound.url }); } }} disabled={isCooldown || triggeringId !== null || isMuted} className={`text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${sound.image_url ? 'bg-white/20 text-white border border-white/20 hover:bg-white/30 disabled:text-gray-400 disabled:border-gray-500 disabled:bg-neutral-800/50' : 'bg-[#FFC200]/10 text-[#FFC200] border border-[#FFC200]/20 disabled:text-gray-500 disabled:border-gray-600 disabled:bg-neutral-800'}`}>▶ ENVIAR</button>}</div>
              </div>;
            })}</div></div>)}</div>;
          })()}
        </div><div className="mt-4 pt-3 border-t border-neutral-700/40 flex flex-wrap items-center justify-between gap-3 text-[10px] text-gray-500 font-bold"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" /><span>Los cooldowns y mutes se sincronizan en tiempo real con todos los miembros VIP.</span></div><div className="flex items-center gap-1.5 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><span>Conectado via Supabase Realtime</span></div></div></div>

        {mySubmissions.filter((s) => s.status === 'pending' || s.status === 'rejected').length > 0 && <div className="shrink-0"><div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] space-y-3"><div className="border-b border-neutral-700/60 pb-3"><span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">En revisión / Rechazados</span><h3 className="font-display font-semibold text-base text-white mt-0.5">Mis Envíos de Audio</h3></div><div className="space-y-2">{mySubmissions.filter((s) => s.status === 'pending' || s.status === 'rejected').map((sub) => <div key={sub.id} className="flex items-start gap-3 bg-[#35373d] border border-neutral-700/40 rounded-xl p-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-display font-semibold text-white truncate">{sub.name}</p><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${sub.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{sub.status === 'rejected' ? '✕ Rechazado' : '⏳ Pendiente'}</span><span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${sub.is_public ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>{sub.is_public ? '🌐' : '🔒'}</span></div>{sub.rejection_reason && <p className="text-[10px] text-red-400 font-semibold mt-1 leading-relaxed">Motivo: {sub.rejection_reason}</p>}<p className="text-[9px] text-gray-600 mt-0.5">{new Date(sub.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p></div><button onClick={() => { setEditingSound({ id: sub.id, name: sub.name, url: sub.url || '', is_public: sub.is_public ?? true, cooldown_seconds: sub.suggested_cooldown_seconds ?? 0 }); setEditSoundName(sub.name); setEditSoundCooldown(String(sub.suggested_cooldown_seconds ?? 0)); setEditSoundPublic(sub.is_public ?? true); setEditingSource('submission'); setEditingSoundAudioEnabled(false); setEditingSoundAudioFile(null); setEditingSoundAudioTrim(null); setEditingSoundAudioError(''); }} className="text-[9px] font-bold px-2 py-1 rounded bg-neutral-700 text-gray-400 hover:text-white border border-neutral-600 cursor-pointer shrink-0 mt-0.5">✏️ Editar</button></div>)}</div></div></div>}

        <div className="shrink-0"><div className="flex items-center gap-3"><button onClick={() => { soundManager.playPop(); setLocalTestMode(!isLocalTestMode); }} className={`py-3 px-4 border rounded-2xl font-display font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,.25)] active:scale-[0.97] ${isLocalTestMode ? 'bg-[#FFC200] text-black border-black shadow-[3px_3px_0_0_#000]' : 'bg-[#2b2d31] text-gray-400 border-black hover:text-white'}`}><span>🎧</span><span>{isLocalTestMode ? 'PRUEBA: ON — Escuchando local' : 'Escuchar antes de enviar'}</span></button>{isLocalTestMode && <span className="text-[9px] text-[#FFC200] font-bold animate-pulse">Los sonidos se reproducen solo en tus auriculares</span>}</div></div>

        <div className="shrink-0 overflow-hidden xl:hidden"><span className="text-[10px] font-medium text-gray-500 tracking-wider uppercase block text-left mb-2 px-1">Uso Reciente (Feed Rápido)</span><div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-3 flex items-center gap-3 overflow-x-auto scrollbar-none whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,.25)]">{recentEvents.length === 0 ? <span className="text-[10px] text-gray-500 font-bold block py-1">Ninguna interacción reciente en el directo</span> : recentEvents.slice(0, 5).map((evt) => { let label = ''; if (evt.type === 'sound' || evt.type === 'audio') label = `SONÓ: ${sounds.find((s) => s.id === evt.content)?.name || evt.content}`; else if (evt.type === 'image' || evt.type === 'image_audio' || evt.type === 'video') label = `MEDIA: ${evt.content}`; else if (evt.type === 'tts') label = `TTS: "${evt.content}"`; else if (evt.type === 'animation') label = `EFECTO: ${evt.content}`; return <div key={evt.id} className="inline-flex items-center gap-2 bg-[#35373d] border border-neutral-700/40 rounded-lg px-2.5 py-1.5 text-[10px] "><span className="w-2 h-2 rounded-full bg-[#FFC200]" /><strong className="text-white">@{evt.sender_roblox_user || 'VIP'}</strong><span className="text-gray-400">{label}</span><span className="font-mono text-[8px] text-gray-500">{new Date(evt.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span></div>; })}</div></div>

        <div className="shrink-0"><MediaSubmissionsHistory session={session} /></div>
      </div>
    </motion.div>
  );
}
