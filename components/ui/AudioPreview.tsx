'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Scissors, Volume2, X } from 'lucide-react';

interface AudioPreviewProps {
  file: File;
  onTrimChange: (start: number, end: number) => void;
  embedded?: boolean;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

export default function AudioPreview({ file, onTrimChange, embedded = false }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [loadingWaveform, setLoadingWaveform] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedTrimStart, setSavedTrimStart] = useState(0);
  const [savedTrimEnd, setSavedTrimEnd] = useState(0);

  // Generate waveform bars dynamically
  useEffect(() => {
    const generateWaveform = async () => {
      setWaveform([]);
      setLoadingWaveform(true);
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const tempContext = new AudioContextClass();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await tempContext.decodeAudioData(arrayBuffer);
        await tempContext.close();

        const channelData = audioBuffer.getChannelData(0);
        const numBars = 80; // Larger waveform representation
        const blockSize = Math.floor(channelData.length / numBars);
        const rawBars: number[] = [];

        for (let i = 0; i < numBars; i++) {
          const start = i * blockSize;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[start + j]);
          }
          rawBars.push(sum / blockSize);
        }

        // Normalize heights
        const maxVal = Math.max(...rawBars);
        const normalizedBars = maxVal > 0 ? rawBars.map(val => val / maxVal) : rawBars;
        setWaveform(normalizedBars);
      } catch (err) {
        console.error('Error generating waveform:', err);
      } finally {
        setLoadingWaveform(false);
      }
    };

    generateWaveform();
  }, [file]);

  // Create object URL for the file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setObjectUrl(url);
      setPlaying(false);
      setCurrentTime(0);
      setTrimStart(0);
      setTrimEnd(0);
    });

    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration;
    // On some mobile browsers, duration is NaN until the audio is played
    if (!isFinite(dur) || isNaN(dur)) {
      // Try to get duration by playing briefly
      audio.play().then(() => {
        audio.pause();
        const retryDur = audioRef.current?.duration;
        if (retryDur && isFinite(retryDur) && !isNaN(retryDur)) {
          setDuration(retryDur);
          setTrimEnd(Math.min(retryDur, 30));
          onTrimChange(0, Math.min(retryDur, 30));
        }
      }).catch(() => {});
      return;
    }
    setDuration(dur);
    setTrimEnd(Math.min(dur, 30));
    onTrimChange(0, Math.min(dur, 30));
  }, [onTrimChange]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    // Stop at trim end
    if (audio.currentTime >= trimEnd) {
      audio.pause();
      audio.currentTime = trimStart;
      setPlaying(false);
    }
  }, [trimEnd, trimStart]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.currentTime = Math.max(trimStart, audio.currentTime < trimStart || audio.currentTime >= trimEnd ? trimStart : audio.currentTime);
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  // Convert pixel position in the bar to time
  const posToTime = useCallback((clientX: number): number => {
    const bar = progressRef.current;
    if (!bar || duration === 0) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleBarMouseDown = (e: React.MouseEvent) => {
    if (dragging) return;
    const t = posToTime(e.clientX);
    const bar = progressRef.current;
    if (!bar || duration === 0) return;
    const rect = bar.getBoundingClientRect();
    const startPx = (trimStart / duration) * rect.width;
    const endPx = (trimEnd / duration) * rect.width;
    const clickPx = e.clientX - rect.left;

    // Expand interaction zone for handles to 16px to make it easier to grab
    if (Math.abs(clickPx - startPx) < 16) {
      setDragging('start');
    } else if (Math.abs(clickPx - endPx) < 16) {
      setDragging('end');
    } else {
      const audio = audioRef.current;
      if (audio) audio.currentTime = Math.max(trimStart, Math.min(trimEnd, t));
      setCurrentTime(t);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const t = posToTime(e.clientX);
    if (dragging === 'start') {
      const newStart = Math.max(0, Math.min(t, trimEnd - 0.5));
      setTrimStart(newStart);
      onTrimChange(newStart, trimEnd);
    } else if (dragging === 'end') {
      const newEnd = Math.min(duration, Math.max(t, trimStart + 0.5), trimStart + 30);
      setTrimEnd(newEnd);
      onTrimChange(trimStart, newEnd);
    }
  }, [dragging, posToTime, trimEnd, trimStart, duration, onTrimChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const openTrimmerModal = () => {
    setSavedTrimStart(trimStart);
    setSavedTrimEnd(trimEnd);
    setIsModalOpen(true);
  };

  const closeTrimmerModalCancel = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setPlaying(false);
    }
    setTrimStart(savedTrimStart);
    setTrimEnd(savedTrimEnd);
    onTrimChange(savedTrimStart, savedTrimEnd);
    setIsModalOpen(false);
  };

  const closeTrimmerModalSave = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setPlaying(false);
    }
    onTrimChange(trimStart, trimEnd);
    setIsModalOpen(false);
  };

  const trimDuration = trimEnd - trimStart;
  const isOverLimit = trimDuration > 30;

  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const playPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const trimmerBody = (
    <>
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-[#FFC200]" />
          <h3 className="font-display font-bold text-sm text-white">Editor de Recorte de Audio</h3>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={closeTrimmerModalCancel}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* File info in Modal */}
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-neutral-900/35 p-3 rounded-xl border border-neutral-700/30">
        <Volume2 className="w-3.5 h-3.5 text-[#FFC200] shrink-0" />
        <span className="truncate font-semibold text-gray-300">{file.name}</span>
        <span className="ml-auto font-mono text-[10px] text-gray-500">
          {formatTime(duration)} total
        </span>
      </div>

      {/* Waveform Timeline Trimmer */}
      <div
        ref={progressRef}
        className="relative h-20 rounded-xl overflow-visible cursor-pointer select-none bg-neutral-900/70 border border-neutral-800"
        onMouseDown={handleBarMouseDown}
      >
        {/* Waveform Bars */}
        <div className="absolute inset-0 flex items-center justify-between px-3 gap-[1.5px]">
          {loadingWaveform ? (
            <div className="w-full text-center text-[10px] text-gray-500 font-bold uppercase tracking-wider animate-pulse">
              Analizando ondas de audio...
            </div>
          ) : waveform.length > 0 ? (
            waveform.map((barHeight, idx) => {
              const barPct = (idx / waveform.length) * 100;
              const isSelected = barPct >= startPct && barPct <= endPct;
              const isPlayed = barPct <= playPct;

              let barColor = 'bg-neutral-700/50';
              if (isSelected) {
                barColor = isPlayed ? 'bg-[#FFC200]' : 'bg-[#FFC200]/50';
              }

              return (
                <div
                  key={idx}
                  className={`w-[3px] rounded-sm transition-colors ${barColor}`}
                  style={{ height: `${Math.max(15, barHeight * 100)}%` }}
                />
              );
            })
          ) : (
            <div className="w-full h-[2px] bg-neutral-700" />
          )}
        </div>

        {/* Mask: Left side excluded */}
        <div
          className="absolute top-0 bottom-0 left-0 rounded-l-xl bg-black/60 backdrop-brightness-75 border-r border-red-500/20"
          style={{ width: `${startPct}%` }}
        />

        {/* Selection box overlay */}
        <div
          className="absolute top-0 bottom-0 bg-[#FFC200]/5 border-t border-b border-[#FFC200]/30"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* Mask: Right side excluded */}
        <div
          className="absolute top-0 bottom-0 right-0 rounded-r-xl bg-black/60 backdrop-brightness-75 border-l border-red-500/20"
          style={{ width: `${100 - endPct}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style={{ left: `${playPct}%` }}
        />

        {/* Trim handles — start */}
        <div
          className="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize flex items-center justify-center z-20 group"
          style={{ left: `${startPct}%` }}
        >
          <div className="w-2 h-[75%] rounded-full bg-[#FFC200] group-hover:scale-y-110 shadow-[0_0_8px_rgba(255,194,0,0.5)] transition-transform" />
        </div>

        {/* Trim handles — end */}
        <div
          className="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize flex items-center justify-center z-20 group"
          style={{ left: `${endPct}%` }}
        >
          <div className="w-2 h-[75%] rounded-full bg-[#FFC200] group-hover:scale-y-110 shadow-[0_0_8px_rgba(255,194,0,0.5)] transition-transform" />
        </div>
      </div>

      {/* Modal Controls Row */}
      <div className="flex items-center gap-4 bg-[#2b2d31]/40 p-3 rounded-xl border border-neutral-700/40">
        <button
          type="button"
          onClick={togglePlay}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#FFC200] hover:brightness-105 text-black transition-all active:scale-95 shrink-0 shadow-lg shadow-black/20"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Reproductor</span>
          <span className="text-xs font-mono text-gray-200">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex flex-col text-right mr-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Duración del Recorte</span>
            <span className={`text-xs font-mono font-bold ${isOverLimit ? 'text-red-400' : 'text-[#FFC200]'}`}>
              {formatTime(trimStart)} → {formatTime(trimEnd)} ({Math.ceil(trimDuration)}s)
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
            isOverLimit
              ? 'bg-red-500/15 text-red-400 border border-red-500/25 animate-pulse'
              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
          }`}>
            {isOverLimit ? 'EXCEDE 30s' : 'RANGO OK'}
          </span>
        </div>
      </div>

      {/* Accessible Range inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 font-bold flex justify-between">
            <span>Marca de Inicio</span>
            <span className="text-gray-200 font-mono text-[10px] bg-neutral-900/40 px-2 py-0.5 rounded border border-neutral-700/45">{formatTime(trimStart)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={trimStart}
            onChange={(e) => {
              const v = Math.min(parseFloat(e.target.value), trimEnd - 0.5);
              setTrimStart(v);
              onTrimChange(v, trimEnd);
            }}
            className="w-full accent-[#FFC200] cursor-pointer"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 font-bold flex justify-between">
            <span>Marca de Fin</span>
            <span className="text-gray-200 font-mono text-[10px] bg-neutral-900/40 px-2 py-0.5 rounded border border-neutral-700/45">{formatTime(trimEnd)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={trimEnd}
            onChange={(e) => {
              const v = Math.max(parseFloat(e.target.value), trimStart + 0.5);
              const clamped = Math.min(v, trimStart + 30);
              setTrimEnd(clamped);
              onTrimChange(trimStart, clamped);
            }}
            className="w-full accent-[#FFC200] cursor-pointer"
          />
        </div>
      </div>

      {isOverLimit && (
        <p className="text-[10.5px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
          El rango de recorte seleccionado excede el límite máximo de 30 segundos. Por favor, reduce la distancia entre el inicio y el fin.
        </p>
      )}

      {/* Modal Actions — only show in non-embedded (portal modal) mode */}
      {!embedded && (
        <div className="flex gap-3 pt-3 border-t border-neutral-700/60">
          <button
            type="button"
            onClick={closeTrimmerModalCancel}
            className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700/80 text-gray-300 font-display font-semibold text-xs rounded-xl transition-all cursor-pointer text-center"
          >
            Cancelar y Descartar
          </button>
          <button
            type="button"
            disabled={isOverLimit}
            onClick={closeTrimmerModalSave}
            className="flex-1 py-2.5 bg-[#FFC200] hover:brightness-105 text-black font-display font-black uppercase text-xs rounded-xl transition-all cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(255,194,0,0.15)]"
          >
            Confirmar Recorte
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="mt-3 bg-[#1e1f22] border border-neutral-700/60 rounded-xl p-4">
      {objectUrl && (
        <audio
          ref={audioRef}
          src={objectUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />
      )}

      {/* COMPACT VIEW (Always visible inline) */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#FFC200] hover:brightness-105 text-black transition-all active:scale-95 shrink-0"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-300 font-bold truncate">{file.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Recorte: <span className="font-mono text-gray-300 font-semibold">{formatTime(trimStart)}</span> → <span className="font-mono text-gray-300 font-semibold">{formatTime(trimEnd)}</span> ({Math.ceil(trimDuration)}s)
            </p>
          </div>
        </div>

        {!embedded && (
          <button
            type="button"
            onClick={openTrimmerModal}
            className="w-full py-2 bg-[#2b2d31] hover:bg-[#35373d] text-white border border-neutral-700/60 text-[11px] font-display font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Scissors className="w-3 h-3 text-[#FFC200]" />
            Recortar / Ajustar Audio
          </button>
        )}

        {isOverLimit && (
          <p className="text-[9px] text-red-400 font-semibold">
            ⚠ El recorte supera los 30s máximos permitidos.
          </p>
        )}
      </div>

      {/* FULL EXPANDED MODAL */}
      {isModalOpen && !embedded && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div
            className="bg-[#1e1f22] border border-neutral-700 w-full max-w-2xl rounded-2xl shadow-2xl p-5 space-y-4 pointer-events-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {trimmerBody}
          </div>
        </div>,
        document.body
      )}

      {embedded && (
        <div className="mt-3 bg-[#1e1f22] border border-neutral-700/60 rounded-xl p-4 space-y-4">
          {trimmerBody}
        </div>
      )}
    </div>
  );
}

