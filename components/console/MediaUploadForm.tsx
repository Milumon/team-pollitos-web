'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Loader2, Image as ImageIcon, Film, Upload, Mic, Square, Volume2 } from 'lucide-react';

type MediaCategory = 'audio' | 'image_audio' | 'video' | 'image';
type AudioSource = 'upload' | 'tts' | 'record';

interface Session {
  access_token: string;
}

interface Props {
  session: Session | null;
  onSuccess: () => void;
  permissions?: Record<string, boolean>;
}

const CATEGORIES: { id: MediaCategory; label: string; icon: React.ReactNode; desc: string; disabled?: boolean }[] = [
  { id: 'audio', label: 'Audio', icon: <Volume2 className="w-4 h-4" />, desc: 'Subir un archivo de audio' },
  { id: 'image_audio', label: 'Imagen + Audio', icon: <ImageIcon className="w-4 h-4" />, desc: 'Imagen con audio (subido, TTS o grabado)' },
  { id: 'video', label: 'Video', icon: <Film className="w-4 h-4" />, desc: 'Video corto (máx 15s)', disabled: true },
  { id: 'image', label: 'Imagen', icon: <ImageIcon className="w-4 h-4" />, desc: 'Imagen o GIF sin audio' },
];

export default function MediaUploadForm({ session, onSuccess, permissions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mediaType, setMediaType] = useState<MediaCategory>('audio');
  const [audioSource, setAudioSource] = useState<AudioSource>('upload');
  const [name, setName] = useState('');
  const [cooldown, setCooldown] = useState('0');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // File states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Video trim state
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // TTS state
  const [ttsText, setTtsText] = useState('');
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsAudioBlob, setTtsAudioBlob] = useState<Blob | null>(null);
  const [ttsPreviewUrl, setTtsPreviewUrl] = useState<string | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartTimeRef = useRef(0);

  const reset = useCallback(() => {
    setName('');
    setAudioFile(null);
    setImageFile(null);
    setVideoFile(null);
    setVideoDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setTtsText('');
    setTtsAudioBlob(null);
    if (ttsPreviewUrl) URL.revokeObjectURL(ttsPreviewUrl);
    setTtsPreviewUrl(null);
    setRecordedBlob(null);
    if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
    setRecordedPreviewUrl(null);
    setCooldown('0');
    setIsPublic(true);
  }, [ttsPreviewUrl, recordedPreviewUrl]);

  // ─── TTS Generation ─────────────────────────────────────────
  const generateTts = async () => {
    if (!ttsText.trim() || !session) return;
    setTtsGenerating(true);
    try {
      const res = await fetch(`/api/stream/tts?text=${encodeURIComponent(ttsText.trim())}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Error generando TTS');
      const blob = await res.blob();
      setTtsAudioBlob(blob);
      if (ttsPreviewUrl) URL.revokeObjectURL(ttsPreviewUrl);
      setTtsPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setStatus(err instanceof Error ? `✕ ${err.message}` : 'Error TTS');
      setTimeout(() => setStatus(null), 5000);
    } finally {
      setTtsGenerating(false);
    }
  };

  // ─── Voice Recording ────────────────────────────────────────
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
        if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
        setRecordedPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      setRecordDuration(0);
      recordStartTimeRef.current = Date.now();
      recordTimerRef.current = setInterval(() => {
        setRecordDuration(Math.floor((Date.now() - recordStartTimeRef.current) / 1000));
      }, 200);
    } catch {
      setStatus('✕ No se pudo acceder al micrófono.');
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  // ─── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !name.trim()) return;

    // Check permissions
    if (permissions) {
      if ((mediaType === 'audio' || mediaType === 'image_audio') && permissions.perm_upload_audio === false) {
        setStatus('✕ No tenés permiso para subir audio.');
        return;
      }
      if (mediaType === 'image' && permissions.perm_upload_images === false) {
        setStatus('✕ No tenés permiso para subir imágenes.');
        return;
      }
      if (mediaType === 'video' && permissions.perm_upload_videos === false) {
        setStatus('✕ No tenés permiso para subir videos.');
        return;
      }
      if (mediaType === 'image_audio' && audioSource === 'tts' && permissions.perm_tts_text === false) {
        setStatus('✕ No tenés permiso para usar TTS por texto.');
        return;
      }
      if (mediaType === 'image_audio' && audioSource === 'record' && permissions.perm_tts_record === false) {
        setStatus('✕ No tenés permiso para usar TTS por grabación.');
        return;
      }
    }

    // Validation
    if (mediaType === 'audio' && !audioFile) return;
    if (mediaType === 'image_audio') {
      if (!imageFile) return;
      if (audioSource === 'upload' && !audioFile) return;
      if (audioSource === 'tts' && !ttsAudioBlob) return;
      if (audioSource === 'record' && !recordedBlob) return;
    }
    if (mediaType === 'video' && !videoFile) return;
    if (mediaType === 'image' && !imageFile) return;

    setSubmitting(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('mediaType', mediaType);
      formData.append('name', name.trim());
      formData.append('suggestedCooldown', cooldown);
      formData.append('isPublic', String(isPublic));

      if (mediaType === 'audio' && audioFile) {
        formData.append('audio', audioFile);
      } else if (mediaType === 'image_audio' && imageFile) {
        formData.append('image', imageFile);
        if (audioSource === 'upload' && audioFile) {
          formData.append('audio', audioFile);
        } else if (audioSource === 'tts' && ttsAudioBlob) {
          const ttsFile = new File([ttsAudioBlob], `tts-${Date.now()}.mp3`, { type: 'audio/mpeg' });
          formData.append('audio', ttsFile);
        } else if (audioSource === 'record' && recordedBlob) {
          const recFile = new File([recordedBlob], `record-${Date.now()}.webm`, { type: 'audio/webm' });
          formData.append('audio', recFile);
        }
      } else       if (mediaType === 'video' && videoFile) {
        formData.append('video', videoFile);
        if (trimStart > 0) formData.append('trimStart', String(trimStart));
        if (trimEnd > 0) formData.append('trimEnd', String(trimEnd));
      } else if (mediaType === 'image' && imageFile) {
        formData.append('image', imageFile);
      }

      setStatus('Subiendo...');
      const response = await fetch('/api/console/media/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al enviar');

      reset();
      setStatus('✓ Enviado para revisión.');
      setTimeout(() => setStatus(null), 5000);
      onSuccess();
    } catch (err) {
      setStatus(err instanceof Error ? `✕ ${err.message}` : 'Error');
      setTimeout(() => setStatus(null), 6000);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Disabled state ─────────────────────────────────────────
  const isSubmitDisabled = submitting || !name.trim() ||
    (mediaType === 'audio' && !audioFile) ||
    (mediaType === 'image_audio' && (!imageFile || (audioSource === 'upload' && !audioFile) || (audioSource === 'tts' && !ttsAudioBlob) || (audioSource === 'record' && !recordedBlob))) ||
    (mediaType === 'video' && !videoFile) ||
    (mediaType === 'image' && !imageFile);

  return (
    <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,.25)]">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Upload className="w-4 h-4 text-[#FFC200]" />
          <span className="font-display font-semibold text-sm text-white">Enviar Media</span>
        </div>
        <span className="text-[10px] text-gray-500 font-bold">{expanded ? '▲ Colapsar' : '▼ Expandir'}</span>
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4 border-t border-neutral-700/40 pt-4">

          {/* ─── Category Selector ──────────────────────────────── */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Tipo de media</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  disabled={cat.disabled}
                  onClick={() => { if (!cat.disabled) { setMediaType(cat.id); reset(); } }}
                  className={`py-2.5 rounded-xl border text-xs font-display font-semibold transition-all flex items-center justify-center gap-2 ${
                    cat.disabled
                      ? 'bg-[#35373d] text-gray-600 border-neutral-700/60 opacity-60 cursor-not-allowed'
                      : mediaType === cat.id
                        ? 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/30 cursor-pointer'
                        : 'bg-[#35373d] text-gray-400 border-neutral-700/60 hover:text-white cursor-pointer'
                  }`}
                >
                  {cat.icon} {cat.label}
                  {cat.disabled && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-neutral-600 text-gray-300 not-italic no-underline ml-1">Próximamente</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Name ──────────────────────────────────────────── */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mi meme, Clip épico..."
              maxLength={40}
              className="w-full bg-[#35373d] border border-neutral-700/60 rounded-xl px-3.5 py-2.5 text-sm focus:border-[#FFC200] focus:ring-1 focus:ring-[#FFC200]/50 outline-none text-white transition-colors"
            />
          </div>

          {/* ─── AUDIO: just file upload ────────────────────────── */}
          {mediaType === 'audio' && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Archivo de audio</label>
              <button
                type="button"
                onClick={() => audioRef.current?.click()}
                className="w-full border border-dashed border-[#FFC200]/45 rounded-xl p-4 bg-[#35373d] hover:bg-[#3a3c42] cursor-pointer transition-colors text-center"
              >
                <Volume2 className="w-6 h-6 text-gray-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400 font-medium truncate">{audioFile ? audioFile.name : 'Elegir audio (MP3, WebM, WAV)'}</p>
              </button>
              <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              {audioFile && (
                <audio controls src={URL.createObjectURL(audioFile)} className="mt-2 w-full h-8" />
              )}
            </div>
          )}

          {/* ─── IMAGE + AUDIO: image + 3 audio sources ─────────── */}
          {mediaType === 'image_audio' && (
            <>
              {/* Image upload */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Imagen / GIF</label>
                <button
                  type="button"
                  onClick={() => imageRef.current?.click()}
                  className="w-full border border-dashed border-[#FFC200]/45 rounded-xl p-3 bg-[#35373d] hover:bg-[#3a3c42] cursor-pointer transition-colors text-center"
                >
                 <ImageIcon className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                  <p className="text-[9px] text-gray-400 font-medium truncate">{imageFile ? imageFile.name : 'Elegir imagen / GIF'}</p>
                </button>
                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                {imageFile && (
                  <Image src={URL.createObjectURL(imageFile)} alt="Preview" width={640} height={128} unoptimized className="mt-2 w-full max-h-32 object-contain rounded-lg" />
                )}
              </div>

              {/* Audio source selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Fuente de audio</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setAudioSource('upload')}
                    className={`py-2 rounded-xl border text-[10px] font-display font-semibold transition-all cursor-pointer ${
                      audioSource === 'upload' ? 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/30' : 'bg-[#35373d] text-gray-400 border-neutral-700/60 hover:text-white'
                    }`}>
                    📁 Subir
                  </button>
                  <button type="button" onClick={() => setAudioSource('tts')}
                    className={`py-2 rounded-xl border text-[10px] font-display font-semibold transition-all cursor-pointer ${
                      audioSource === 'tts' ? 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/30' : 'bg-[#35373d] text-gray-400 border-neutral-700/60 hover:text-white'
                    }`}>
                    🗣️ TTS
                  </button>
                  <button type="button" onClick={() => setAudioSource('record')}
                    className={`py-2 rounded-xl border text-[10px] font-display font-semibold transition-all cursor-pointer ${
                      audioSource === 'record' ? 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/30' : 'bg-[#35373d] text-gray-400 border-neutral-700/60 hover:text-white'
                    }`}>
                    🎤 Grabar
                  </button>
                </div>
              </div>

              {/* Audio source content */}
              {audioSource === 'upload' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Archivo de audio</label>
                  <button type="button" onClick={() => audioRef.current?.click()}
                    className="w-full border border-dashed border-[#FFC200]/45 rounded-xl p-3 bg-[#35373d] hover:bg-[#3a3c42] cursor-pointer transition-colors text-center">
                    <Upload className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                    <p className="text-[9px] text-gray-400 font-medium truncate">{audioFile ? audioFile.name : 'Elegir audio'}</p>
                  </button>
                  <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                  {audioFile && <audio controls src={URL.createObjectURL(audioFile)} className="mt-2 w-full h-8" />}
                </div>
              )}

              {audioSource === 'tts' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Texto para TTS</label>
                  <textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value.slice(0, 120))}
                    placeholder="Escribí el texto que la voz del stream va a leer..."
                    className="w-full bg-[#35373d] border border-neutral-700/60 rounded-xl px-3.5 py-2.5 text-sm focus:border-[#FFC200] focus:ring-1 focus:ring-[#FFC200]/50 outline-none text-white transition-colors min-h-[80px] resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void generateTts()} disabled={!ttsText.trim() || ttsGenerating}
                      className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
                      {ttsGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : '🗣️'} Generar audio
                    </button>
                    <span className="text-[9px] text-gray-500 font-mono">{ttsText.length}/120</span>
                  </div>
                  {ttsPreviewUrl && (
                    <div className="flex items-center gap-2">
                      <audio controls src={ttsPreviewUrl} className="flex-1 h-8" />
                      <button type="button" onClick={() => { setTtsAudioBlob(null); setTtsPreviewUrl(null); setTtsText(''); }}
                        className="text-[9px] text-red-400 hover:text-red-300 font-bold cursor-pointer">✕ Borrar</button>
                    </div>
                  )}
                </div>
              )}

              {audioSource === 'record' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Grabar voz</label>
                  {!recordedBlob ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      {isRecording ? (
                        <>
                          <div className="w-16 h-16 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center animate-pulse">
                            <div className="w-5 h-5 rounded-full bg-red-500" />
                          </div>
                          <span className="text-xs font-mono text-red-400 font-bold">{recordDuration}s</span>
                          <button type="button" onClick={stopRecording}
                            className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-display font-semibold rounded-xl transition-all cursor-pointer active:scale-[0.97]">
                            <Square className="w-3 h-3 inline mr-1" /> Detener
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={startRecording}
                          className="w-16 h-16 rounded-full bg-neutral-700 hover:bg-neutral-600 border-2 border-neutral-600 flex items-center justify-center transition-all cursor-pointer">
                          <Mic className="w-6 h-6 text-white" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <audio controls src={recordedPreviewUrl || undefined} className="w-full h-8" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setRecordedBlob(null); setRecordedPreviewUrl(null); setRecordDuration(0); }}
                          className="flex-1 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                          🔄 Re-grabar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── VIDEO ──────────────────────────────────────────── */}
          {mediaType === 'video' && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Video (máx 15s, 20MB)</label>
              <button type="button" onClick={() => videoRef.current?.click()}
                className="w-full border border-dashed border-[#FFC200]/45 rounded-xl p-4 bg-[#35373d] hover:bg-[#3a3c42] cursor-pointer transition-colors text-center">
                <Film className="w-6 h-6 text-gray-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400 font-medium truncate">{videoFile ? videoFile.name : 'Elegir video (MP4, WebM)'}</p>
              </button>
              <input ref={videoRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setVideoFile(file);
                setVideoDuration(0);
                setTrimStart(0);
                setTrimEnd(0);
              }} />
              {videoFile && videoFile.size > 20 * 1024 * 1024 && (
                <p className="text-[10px] text-red-400 font-semibold mt-1">⚠ El video supera los 20MB. Subí un archivo más pequeño.</p>
              )}
              {videoFile && (
                <div className="mt-2 space-y-2">
                  <video
                    key={videoFile.name + videoFile.size}
                    controls
                    playsInline
                    preload="metadata"
                    src={URL.createObjectURL(videoFile)}
                    className="w-full rounded-lg bg-black/50 max-h-[360px] object-contain"
                    onLoadedMetadata={(e) => {
                      const dur = e.currentTarget.duration;
                      setVideoDuration(dur);
                      if (dur > 0 && trimEnd === 0) setTrimEnd(dur);
                    }}
                  />
                  {videoDuration > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="text-[9px] text-gray-500 font-bold w-12 text-right">Inicio</label>
                        <input
                          type="range"
                          min={0}
                          max={videoDuration}
                          step={0.1}
                          value={trimStart}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setTrimStart(v);
                            if (v >= trimEnd) setTrimEnd(Math.min(v + 1, videoDuration));
                          }}
                          className="flex-1 accent-[#FFC200] h-1"
                        />
                        <span className="text-[9px] font-mono text-gray-400 w-10">{trimStart.toFixed(1)}s</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[9px] text-gray-500 font-bold w-12 text-right">Fin</label>
                        <input
                          type="range"
                          min={0}
                          max={videoDuration}
                          step={0.1}
                          value={trimEnd}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setTrimEnd(v);
                            if (v <= trimStart) setTrimStart(Math.max(v - 1, 0));
                          }}
                          className="flex-1 accent-[#FFC200] h-1"
                        />
                        <span className="text-[9px] font-mono text-gray-400 w-10">{trimEnd.toFixed(1)}s</span>
                      </div>
                      <p className="text-[9px] text-gray-500 text-center">
                        Duración recortada: <span className="font-mono text-[#FFC200]">{(trimEnd - trimStart).toFixed(1)}s</span>
                        {videoFile.size > 20 * 1024 * 1024 && (
                          <span className="text-red-400"> — Archivo demasiado grande</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── IMAGE only ─────────────────────────────────────── */}
          {mediaType === 'image' && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Imagen / GIF</label>
              <button type="button" onClick={() => imageRef.current?.click()}
                className="w-full border border-dashed border-[#FFC200]/45 rounded-xl p-4 bg-[#35373d] hover:bg-[#3a3c42] cursor-pointer transition-colors text-center">
                 <ImageIcon className="w-6 h-6 text-gray-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400 font-medium truncate">{imageFile ? imageFile.name : 'Elegir imagen / GIF'}</p>
              </button>
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              {imageFile && (
                <Image src={URL.createObjectURL(imageFile)} alt="Preview" width={640} height={160} unoptimized className="mt-2 w-full max-h-40 object-contain rounded-lg" />
              )}
            </div>
          )}

          {/* ─── Cooldown + Visibility ──────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Cooldown (seg)</label>
              <input
                type="number" min={0} max={300}
                value={cooldown}
                onChange={(e) => setCooldown(e.target.value)}
                className="w-full bg-[#35373d] border border-neutral-700/60 rounded-xl px-3.5 py-2.5 text-sm focus:border-[#FFC200] focus:ring-1 focus:ring-[#FFC200]/50 outline-none text-white transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Visibilidad</label>
              <button type="button" onClick={() => setIsPublic(p => !p)}
                className={`w-full h-[42px] rounded-xl border text-xs font-display font-semibold transition-all cursor-pointer ${
                  isPublic ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                {isPublic ? '🌍 Público' : '🔒 Solo yo'}
              </button>
            </div>
          </div>

          {/* ─── Status ─────────────────────────────────────────── */}
          {status && (
            <p className={`text-xs font-semibold ${status.startsWith('✓') ? 'text-emerald-400' : status.startsWith('✕') ? 'text-red-400' : 'text-[#FFC200]'}`}>{status}</p>
          )}

          {/* ─── Submit ─────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-3 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-sm rounded-xl transition-all cursor-pointer active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {submitting ? 'Enviando...' : 'Enviar para revisión'}
          </button>
        </form>
      )}
    </div>
  );
}
