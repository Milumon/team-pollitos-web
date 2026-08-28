'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ShieldAlert } from 'lucide-react';
import { OverlayCanvas, CANVAS_W, CANVAS_H, type OverlayParticle, type OverlayAnimationType } from '@/components/OverlayCanvas';

type StreamEvent = {
  id: string;
  type: 'sound' | 'tts' | 'animation' | 'voice' | 'image_audio' | 'video' | 'audio' | 'image';
  content: string;
  sender_roblox_user: string | null;
  sender_tiktok_user: string | null;
  sender_avatar_url: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  trim_start?: number | null;
  trim_end?: number | null;
  message?: string | null;
  repeat_enabled?: boolean;
  created_at: string;
  played: boolean;
};

type StreamSettings = {
  id: number;
  is_muted: boolean;
  global_cooldown_seconds: number;
  personal_cooldown_seconds: number;
  overlay_notification_top?: number;
  overlay_notification_left?: number;
  overlay_notification_width?: number;
  overlay_notification_badge_size?: number;
  overlay_notification_content_size?: number;
  overlay_notification_sender_size?: number;
  overlay_media_top?: number;
  overlay_media_left?: number;
  overlay_media_width?: number;
  overlay_media_message_size?: number;
  overlay_media_repeat_count?: number;
  overlay_image_duration_seconds?: number;
  overlay_image_reposition_interval_seconds?: number;
  overlay_random_position?: boolean;
};



const CONFETTI_COLORS = ['#ff4500', '#ffd700', '#00ff7f', '#1e90ff', '#ff1493', '#8a2be2'];

// Re-exportamos el tipo desde el componente compartido para no duplicarlo
type Particle = OverlayParticle;

// Helper to log both to console and back to server for remote visibility
const remoteLog = (level: string, message: string, data?: unknown) => {
  console.log(`[${level}] ${message}`, data ? JSON.stringify(data) : '');
  fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message, data }),
  }).catch(() => {});
};

export default function ObsOverlayPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [settings, setSettings] = useState<StreamSettings | null>(null);
  const [soundsMap, setSoundsMap] = useState<Record<string, { url: string; name: string }>>({});
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => '',
  );
  const params = new URLSearchParams(search);
  const isDebug = params.get('debug') === 'true';
  const volumeParam = parseFloat(params.get('volume') ?? '1');
  const soundVolume = Number.isNaN(volumeParam) ? 1 : Math.max(0, Math.min(1, volumeParam));
  const [canvasFitScale, setCanvasFitScale] = useState(1);
  const aspectContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = aspectContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCanvasFitScale(Math.min(height / CANVAS_H, width / CANVAS_W, 1));
    });
    observer.observe(el);
    const { clientWidth: w, clientHeight: h } = el;
    if (w > 0 && h > 0) {
      setCanvasFitScale(Math.min(h / CANVAS_H, w / CANVAS_W, 1));
    }
    return () => observer.disconnect();
  }, []);

  // Queue state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<StreamEvent | null>(null);
  const currentEventRef = useRef<StreamEvent | null>(null);
  
  // Animation overlay state
  const [activeAnimation, setActiveAnimation] = useState<OverlayAnimationType>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Image repositioning state
  const [imagePositionIndex, setImagePositionIndex] = useState(0);
  const [imagePositions, setImagePositions] = useState<Array<{ x: number; y: number }>>([]);
  const imageRepositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueRef = useRef<StreamEvent[]>([]);
  const isPlayingRef = useRef(false);
  const settingsRef = useRef<StreamSettings | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioEventRef = useRef<string | null>(null);
  
  const warnedRealtimeRef = useRef(false);
  const playNextRef = useRef<() => void>(() => {});
  const soundsLoadedRef = useRef(false);

  // Helper: generate random position within valid media area
  const generateRandomPosition = useCallback((mediaWidth: number) => {
    const CANVAS_W = 720;
    const CANVAS_H = 1280;
    const effectiveWidth = Math.min(mediaWidth, CANVAS_W * 0.9);
    const maxXPercent = ((CANVAS_W - effectiveWidth) / CANVAS_W) * 100;
    const maxY = CANVAS_H - 720;
    const minY = 420;
    return {
      x: Math.random() * maxXPercent,
      y: minY + Math.random() * (maxY - minY),
    };
  }, []);

  // 1. Mark event as played in DB
  const markEventAsPlayed = useCallback(async (eventId: string) => {
    if (!token) {
      remoteLog('WARN', 'Intentando marcar evento como jugado, pero no hay token.');
      return;
    }
    try {
      remoteLog('DEBUG', `Marcando evento ${eventId} como jugado...`);
      const response = await fetch('/api/stream/events/played', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-overlay-token': token,
        },
        body: JSON.stringify({ eventId }),
      });
      const data = await response.json();
      if (!response.ok) {
        remoteLog('ERROR', `Error en API /played: Status ${response.status}, payload:`, data);
      } else {
        remoteLog('INFO', `Evento ${eventId} marcado exitosamente como jugado.`);
      }
    } catch (err) {
      const error = err as Error;
      remoteLog('ERROR', `Error al marcar evento como jugado: ${error.message}`);
    }
  }, [token]);

  // 2. Play Next Queue Item
  const playNext = useCallback(async () => {
    remoteLog('DEBUG', `playNext - Cola restante: ${queueRef.current.length}, isPlayingRef: ${isPlayingRef.current}`);

    if (settingsRef.current?.is_muted) {
      remoteLog('INFO', 'Mute activo en configuraciones. Limpiando reproducción.');
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentEvent(null);
      currentEventRef.current = null;
      setActiveAnimation(null);
      return;
    }

    if (queueRef.current.length === 0) {
      remoteLog('DEBUG', 'Cola vacía. Deteniendo reproducción.');
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentEvent(null);
      currentEventRef.current = null;
      setActiveAnimation(null);
      return;
    }

    // Failsafe: Si el siguiente es sonido pero la lista no ha cargado, esperamos
    const nextPeek = queueRef.current[0];
    if ((nextPeek.type === 'sound' || nextPeek.type === 'audio') && !soundsLoadedRef.current && !nextPeek.audio_url) {
      remoteLog('WARN', `El siguiente evento es sonido (${nextPeek.content}) pero el mapa de sonidos no ha cargado. Re-intentando en 500ms...`);
      setTimeout(() => { playNextRef.current(); }, 500);
      return;
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    const nextEvent = queueRef.current.shift()!;
    setCurrentEvent(nextEvent);
    currentEventRef.current = nextEvent;
    currentAudioEventRef.current = null;

    remoteLog('INFO', `Reproduciendo evento: id=${nextEvent.id}, type=${nextEvent.type}, content=${nextEvent.content}`);

    if (nextEvent.type === 'sound') {
      const cleanKey = nextEvent.content.replace('.mp3', '');
      const soundData = soundsMap[cleanKey];
      let audioUrl = soundData ? soundData.url : `/sounds/${nextEvent.content}`;

      // Si el sonido no está en el mapa (puede ser privado), resolverlo por ID
      if (!soundData && token) {
        try {
          remoteLog('DEBUG', `Sonido ${cleanKey} no encontrado en mapa. Fetch individual...`);
          const res = await fetch(`/api/admin/sounds/${encodeURIComponent(cleanKey)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.sound?.url) {
              audioUrl = data.sound.url;
              // Cache para no volver a pedir
              setSoundsMap(prev => ({ ...prev, [cleanKey]: { url: data.sound.url, name: data.sound.name } }));
              remoteLog('INFO', `Sonido ${cleanKey} resuelto por fetch individual: ${audioUrl}`);
            }
          }
        } catch (fetchErr) {
          remoteLog('ERROR', `Error fetch sonido individual: ${fetchErr}`);
        }
      }
      
      remoteLog('INFO', `Sonido: key=${cleanKey}, enMapa=${!!soundData}, url=${audioUrl}`);

      if (audioPlayerRef.current) {
        currentAudioEventRef.current = nextEvent.id;
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.volume = soundVolume;
        try {
          remoteLog('DEBUG', 'Llamando a audio.play()...');
          await audioPlayerRef.current.play();
          remoteLog('DEBUG', 'audio.play() completado con éxito.');
        } catch (err) {
          const error = err as Error;
          remoteLog('ERROR', `Fallo al reproducir audio del sonido: ${error.name} - ${error.message}`);
          if (error.name === 'NotAllowedError') {
            remoteLog('WARN', 'Autoplay bloqueado por el navegador. Mostrando pantalla de interacción.');
            setNeedsInteraction(true);
            // Ponemos el evento de vuelta al inicio de la cola
            queueRef.current.unshift(nextEvent);
            setIsPlaying(false);
            isPlayingRef.current = false;
            setCurrentEvent(null);
            currentEventRef.current = null;
          } else {
            // Failsafe: marcar como jugado y saltar a otro sonido
            await markEventAsPlayed(nextEvent.id);
            setTimeout(() => { playNextRef.current(); }, 500);
          }
        }
      }
    } else if (nextEvent.type === 'tts') {
      const ttsUrl = `/api/stream/tts?text=${encodeURIComponent(nextEvent.content)}`;
      remoteLog('INFO', `Reproduciendo TTS: url=${ttsUrl}`);
      if (audioPlayerRef.current) {
        currentAudioEventRef.current = nextEvent.id;
        audioPlayerRef.current.src = ttsUrl;
        try {
          remoteLog('DEBUG', 'Llamando a audio.play() para TTS...');
          await audioPlayerRef.current.play();
          remoteLog('DEBUG', 'TTS play() completado con éxito.');
        } catch (err) {
          const error = err as Error;
          remoteLog('ERROR', `Fallo al reproducir TTS: ${error.name} - ${error.message}`);
          if (error.name === 'NotAllowedError') {
            remoteLog('WARN', 'Autoplay bloqueado para TTS. Mostrando pantalla de interacción.');
            setNeedsInteraction(true);
            queueRef.current.unshift(nextEvent);
            setIsPlaying(false);
            isPlayingRef.current = false;
            setCurrentEvent(null);
            currentEventRef.current = null;
          } else {
            await markEventAsPlayed(nextEvent.id);
            setTimeout(() => { playNextRef.current(); }, 500);
          }
        }
      }
    } else if (nextEvent.type === 'voice') {
      // Voice message: content is the audio URL directly
      const voiceUrl = nextEvent.content;
      remoteLog('INFO', `[VOICE] URL: ${voiceUrl}`);
      
      if (!audioPlayerRef.current) {
        remoteLog('ERROR', '[VOICE] audioPlayerRef is null');
        await markEventAsPlayed(nextEvent.id);
        setTimeout(() => { playNextRef.current(); }, 500);
        return;
      }

      // Check URL accessibility first
      try {
        const headResp = await fetch(voiceUrl, { method: 'HEAD' });
        remoteLog('INFO', `[VOICE] URL check: status=${headResp.status}, type=${headResp.headers.get('content-type')}, size=${headResp.headers.get('content-length')}`);
      } catch (fetchErr) {
        remoteLog('ERROR', `[VOICE] URL inaccesible: ${fetchErr}`);
      }

      audioPlayerRef.current.src = voiceUrl;
      currentAudioEventRef.current = nextEvent.id;
      
      // Race: play() vs 5s timeout
      const playPromise = audioPlayerRef.current.play();
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('play() timeout 5s')), 5000)
      );
      
      try {
        remoteLog('DEBUG', '[VOICE] Esperando play()...');
        await Promise.race([playPromise, timeoutPromise]);
        remoteLog('INFO', '[VOICE] play() OK - audio reproduciendo');
        // Fallback: si onEnded no dispara en 30s, forzar avance
        setTimeout(async () => {
          if (currentEventRef.current?.id === nextEvent.id) {
            remoteLog('WARN', '[VOICE] 30s timeout - forzando avance');
            await markEventAsPlayed(nextEvent.id);
            playNextRef.current();
          }
        }, 30000);
      } catch (err) {
        const error = err as Error;
        remoteLog('ERROR', `[VOICE] play() falló: ${error.message}`);
        await markEventAsPlayed(nextEvent.id);
        setTimeout(() => { playNextRef.current(); }, 500);
      }
    } else if (nextEvent.type === 'image_audio') {
      // Image + Audio: play audio, display image via overlay settings
      const audioUrl = nextEvent.audio_url || nextEvent.content;
      remoteLog('INFO', `[IMAGE_AUDIO] audio=${audioUrl}, image=${nextEvent.image_url}`);

      if (audioPlayerRef.current && audioUrl) {
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.volume = soundVolume;
        const playPromise = audioPlayerRef.current.play();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('play() timeout 5s')), 5000)
        );
        try {
          await Promise.race([playPromise, timeoutPromise]);
          remoteLog('INFO', '[IMAGE_AUDIO] play() OK');
          const audioDuration = (audioPlayerRef.current?.duration || 5) * 1000;
          setTimeout(async () => {
            if (currentEventRef.current?.id === nextEvent.id) {
              await markEventAsPlayed(nextEvent.id);
              playNextRef.current();
            }
          }, audioDuration);
        } catch (err) {
          const error = err as Error;
          remoteLog('ERROR', `[IMAGE_AUDIO] play() falló: ${error.message}`);
          await markEventAsPlayed(nextEvent.id);
          setTimeout(() => { playNextRef.current(); }, 500);
        }
      } else {
        await markEventAsPlayed(nextEvent.id);
        setTimeout(() => { playNextRef.current(); }, 500);
      }
    } else if (nextEvent.type === 'video') {
      // Video: just display via overlay, auto-advance after timeout
      remoteLog('INFO', `[VIDEO] url=${nextEvent.video_url}`);
      const videoDuration = (nextEvent.trim_start != null && nextEvent.trim_end != null && nextEvent.trim_end > nextEvent.trim_start)
        ? (nextEvent.trim_end - nextEvent.trim_start) * 1000
        : 30000;
      setTimeout(async () => {
        await markEventAsPlayed(nextEvent.id);
        playNextRef.current();
      }, videoDuration);
    } else if (nextEvent.type === 'audio') {
      // Audio-only: content is the sound ID, resolve URL from soundsMap or fetch
      const cleanKey = nextEvent.content.replace('.mp3', '');
      const soundData = soundsMap[cleanKey];
      let audioUrl = soundData ? soundData.url : nextEvent.audio_url || `/sounds/${nextEvent.content}`;

      if (!soundData && !nextEvent.audio_url && token) {
        try {
          const res = await fetch(`/api/admin/sounds/${encodeURIComponent(cleanKey)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.sound?.url) {
              audioUrl = data.sound.url;
              setSoundsMap(prev => ({ ...prev, [cleanKey]: { url: data.sound.url, name: data.sound.name } }));
            }
          }
        } catch { /* ignore */ }
      }

      remoteLog('INFO', `[AUDIO] url=${audioUrl}`);
      if (audioPlayerRef.current && audioUrl) {
        currentAudioEventRef.current = nextEvent.id;
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.volume = soundVolume;
        const playPromise = audioPlayerRef.current.play();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('play() timeout 5s')), 5000)
        );
        try {
          await Promise.race([playPromise, timeoutPromise]);
          remoteLog('INFO', '[AUDIO] play() OK');
          setTimeout(async () => {
            if (currentEventRef.current?.id === nextEvent.id) {
              await markEventAsPlayed(nextEvent.id);
              playNextRef.current();
            }
          }, 30000);
        } catch (err) {
          const error = err as Error;
          remoteLog('ERROR', `[AUDIO] play() falló: ${error.message}`);
          await markEventAsPlayed(nextEvent.id);
          setTimeout(() => { playNextRef.current(); }, 500);
        }
      } else {
        await markEventAsPlayed(nextEvent.id);
        setTimeout(() => { playNextRef.current(); }, 500);
      }
    } else if (nextEvent.type === 'image') {
      // Image-only: display image with repositioning
      // If message exists, play TTS and use audio duration; otherwise use configured duration
      const hasMessage = !!nextEvent.message?.trim();
      const fallbackDuration = (settingsRef.current?.overlay_image_duration_seconds ?? 3) * 1000;
      const repositionInterval = (settingsRef.current?.overlay_image_reposition_interval_seconds ?? 1) * 1000;
      const mediaWidth = settingsRef.current?.overlay_media_width ?? 400;

      const startImageDisplay = async (durationMs: number) => {
        // Compute position sequence based on actual duration
        const positionCount = Math.max(1, Math.floor(durationMs / repositionInterval));
        const positions: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < positionCount; i++) {
          positions.push(generateRandomPosition(mediaWidth));
        }
        setImagePositions(positions);
        setImagePositionIndex(0);

        remoteLog('INFO', `[IMAGE] url=${nextEvent.image_url}, duration=${durationMs}ms, tts=${hasMessage}, positions=${positionCount}`);

        // Set up repositioning timer
        let currentIndex = 0;
        const advancePosition = () => {
          currentIndex++;
          if (currentIndex < positions.length) {
            setImagePositionIndex(currentIndex);
            imageRepositionTimerRef.current = setTimeout(advancePosition, repositionInterval);
          }
        };
        if (positions.length > 1) {
          imageRepositionTimerRef.current = setTimeout(advancePosition, repositionInterval);
        }

        // Auto-advance after duration (fallback if onEnded doesn't fire)
          setTimeout(async () => {
            if (currentEventRef.current?.id !== nextEvent.id) return;
            if (imageRepositionTimerRef.current) {
            clearTimeout(imageRepositionTimerRef.current);
            imageRepositionTimerRef.current = null;
          }
          await markEventAsPlayed(nextEvent.id);
          playNextRef.current();
        }, durationMs);
      };

      if (hasMessage && audioPlayerRef.current) {
        // Play TTS of the message — image duration = audio duration
        const ttsUrl = `/api/stream/tts?text=${encodeURIComponent(nextEvent.message!.trim())}`;
        remoteLog('INFO', `[IMAGE+TTS] tts=${ttsUrl}`);

        audioPlayerRef.current.src = ttsUrl;
        currentAudioEventRef.current = nextEvent.id;
        audioPlayerRef.current.volume = soundVolume;

        // Wait for metadata to get actual audio duration
        const onMeta = async () => {
          audioPlayerRef.current?.removeEventListener('loadedmetadata', onMeta);
          const audioDuration = ((audioPlayerRef.current?.duration || 5) * 1000) + 500; // +500ms buffer
          await startImageDisplay(audioDuration);
        };
        audioPlayerRef.current.addEventListener('loadedmetadata', onMeta);

        try {
          await audioPlayerRef.current.play();
          remoteLog('INFO', `[IMAGE+TTS] play() OK`);
        } catch (err) {
          const error = err as Error;
          remoteLog('ERROR', `[IMAGE+TTS] play() falló: ${error.message}`);
          audioPlayerRef.current.removeEventListener('loadedmetadata', onMeta);
          // Fallback: show image without TTS
          await startImageDisplay(fallbackDuration);
        }
      } else {
        // No message or no audio player: use configured duration
        await startImageDisplay(fallbackDuration);
      }
    } else if (nextEvent.type === 'animation') {
      // Setup particles
      const animType = nextEvent.content as 'eggs' | 'sparkles' | 'confetti';
      setActiveAnimation(animType);

      const generated: Particle[] = [];
      const count = animType === 'confetti' ? 60 : 30;
      
      for (let i = 0; i < count; i++) {
        generated.push({
          id: i,
          char: animType === 'eggs' ? '🥚' : animType === 'sparkles' ? '✨' : undefined,
          color: animType === 'confetti' ? CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] : undefined,
          size: Math.random() * 20 + 20, // 20px - 40px
          left: Math.random() * 95, // left %
          delay: Math.random() * 1.5, // 0s - 1.5s delay
          duration: Math.random() * 2 + 2, // 2s - 4s duration
          rotation: Math.random() * 360,
        });
      }
      setParticles(generated);

      // Hold animation for 5 seconds, then advance
      setTimeout(async () => {
        await markEventAsPlayed(nextEvent.id);
        setParticles([]);
        setActiveAnimation(null);
        playNextRef.current();
      }, 5500);
    }
  }, [generateRandomPosition, markEventAsPlayed, soundVolume, soundsMap, token]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  // 3. Audio Ended Listener
  const handleAudioEnded = useCallback(async () => {
    const audioEventId = currentAudioEventRef.current;
    if (!audioEventId || currentEventRef.current?.id !== audioEventId) {
      remoteLog('DEBUG', `handleAudioEnded ignorado: audio=${audioEventId}, evento=${currentEventRef.current?.id}`);
      return;
    }
    currentAudioEventRef.current = null;
    remoteLog('DEBUG', `handleAudioEnded - evento actual: ${audioEventId}`);
    if (currentEventRef.current?.id === audioEventId) {
      await markEventAsPlayed(audioEventId);
    }
    playNextRef.current();
  }, [markEventAsPlayed]);

  // 3.1. Audio Error Listener (Para evitar que la cola se quede trabada ante fallos)
  const handleAudioError = useCallback(async (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const target = e.currentTarget;
    const errorDetails = target.error 
      ? { code: target.error.code, message: target.error.message } 
      : 'Detalles desconocidos';
    remoteLog('ERROR', 'Evento handleAudioError disparado en elemento <audio>', errorDetails);

    const failedAudioEventId = currentAudioEventRef.current;
    if (!failedAudioEventId || currentEventRef.current?.id !== failedAudioEventId) {
      remoteLog('DEBUG', `handleAudioError ignorado por audio atrasado: audio=${failedAudioEventId}, evento=${currentEventRef.current?.id}`);
      return;
    }

    currentAudioEventRef.current = null;
    if (currentEventRef.current?.id === failedAudioEventId) {
      await markEventAsPlayed(failedAudioEventId);
    }
    setTimeout(() => {
      playNextRef.current();
    }, 1000);
  }, [markEventAsPlayed]);

  const loadSounds = useCallback(async () => {
    try {
      remoteLog('DEBUG', 'loadSounds - Buscando sonidos desde API...');
      const headers: Record<string, string> = {};
      if (token) {
        headers['x-overlay-token'] = token;
      }
      const response = await fetch('/api/admin/sounds', { headers });
      const data = await response.json();
      if (data.sounds) {
        const mapping: Record<string, { url: string; name: string }> = {};
        data.sounds.forEach((sound: { id: string; url: string; name: string }) => {
          mapping[sound.id] = { url: sound.url, name: sound.name };
        });
        remoteLog('INFO', `loadSounds - Sonidos mapeados exitosamente. Cantidad: ${Object.keys(mapping).length}`);
        setSoundsMap(mapping);
        soundsLoadedRef.current = true;
      } else {
        remoteLog('WARN', 'loadSounds - No se recibieron sonidos', data);
      }
    } catch (err) {
      const error = err as Error;
      remoteLog('ERROR', `loadSounds - Excepción: ${error.message}`);
    }
  }, [token]);

  // Read query token and fetch settings/events on mount
  useEffect(() => {
    const initializeOverlay = async () => {
      const params = new URLSearchParams(window.location.search);
      const queryToken = params.get('key');

      remoteLog('DEBUG', 'Iniciando inicialización de overlay.');

      if (!queryToken) {
        remoteLog('WARN', 'El enlace no contiene una clave de overlay.');
        setLoading(false);
        setAuthorized(false);
        return;
      }

      setToken(queryToken);

      // Verify token via settings fetch
      try {
        remoteLog('DEBUG', 'Verificando token cargando ajustes...');
        const response = await fetch('/api/stream/settings', {
          headers: { 'x-overlay-token': queryToken },
        });

        if (!response.ok) {
          remoteLog('ERROR', `Fallo al verificar token. Status HTTP: ${response.status}`);
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const data = await response.json();
        remoteLog('INFO', `Ajustes obtenidos. Muted: ${data.is_muted}`);
        setSettings(data);
        settingsRef.current = data;
        setAuthorized(true);

        // Fetch unplayed events to initialize the queue
        remoteLog('DEBUG', 'Buscando eventos no jugados para inicializar cola...');
        const eventsResponse = await fetch('/api/stream/events', {
          headers: { 'x-overlay-token': queryToken },
        });
        const eventsData = await eventsResponse.json();
        if (eventsData.events) {
          const unplayed = (eventsData.events as StreamEvent[])
            .filter((e) => e.created_at && !e.played)
            .reverse(); // FIFO: oldest first
          
          remoteLog('INFO', `Eventos iniciales en cola no jugados: ${unplayed.length}`);
          queueRef.current = unplayed;
          if (!isPlayingRef.current && queueRef.current.length > 0) {
            playNextRef.current();
          }
        }
      } catch (err) {
        const error = err as Error;
        remoteLog('ERROR', `Excepción en inicialización del overlay: ${error.message}`);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    void initializeOverlay();
  }, []);

  // Load and Subscribe to Soundboard Sounds
  useEffect(() => {
    if (!authorized) return;

    Promise.resolve().then(() => {
      void loadSounds();
    });

    const soundsChannel = supabase
      .channel('overlay-soundboard-sounds')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'soundboard_sounds' },
        () => {
          console.log('[Overlay] Cambios detectados en la base de datos de sonidos. Recargando...');
          void loadSounds();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(soundsChannel);
    };
  }, [authorized, loadSounds]);

  // Heartbeat del Overlay para certificar conectividad
  useEffect(() => {
    if (!authorized || !token) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/stream/settings', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-overlay-token': token,
          },
          body: JSON.stringify({ heartbeat: true }),
        });
      } catch (err) {
        console.error('[Overlay Heartbeat Error]:', err);
      }
    };

    void sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [authorized, token]);

  // Handle Realtime updates (stream_events & stream_settings)
  useEffect(() => {
    if (!authorized || !token) return;

    // Realtime Stream Settings Subscription (Panic Button check)
    const settingsChannel = supabase
      .channel('overlay-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stream_settings', filter: 'id=eq.1' },
        (payload: { new: StreamSettings }) => {
          const nextSettings = payload.new;
          console.log('[Overlay] Ajustes actualizados:', nextSettings);
          setSettings(nextSettings);
          settingsRef.current = nextSettings;

          // If panic button is pressed (is_muted === true)
          if (nextSettings.is_muted) {
            if (audioPlayerRef.current) {
              audioPlayerRef.current.pause();
              audioPlayerRef.current.src = '';
            }
            queueRef.current = [];
            isPlayingRef.current = false;
            setIsPlaying(false);
            setCurrentEvent(null);
            setActiveAnimation(null);
            setParticles([]);
          }
        }
      )
      .subscribe();

    // Realtime Stream Events Subscription (FIFO queue pushes & queue clear updates)
    const eventsChannel = supabase
      .channel('overlay-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_events' },
        (payload: { new: StreamEvent }) => {
          const newEvent = payload.new;
          
          // Check if muted
          if (settingsRef.current?.is_muted) {
            console.log('[Overlay] Evento ignorado (mute activo):', newEvent.id);
            return;
          }

          // Evitar procesar eventos duplicados
          if (queueRef.current.some((e) => e.id === newEvent.id) || currentEventRef.current?.id === newEvent.id) {
            console.log('[Overlay] Evento ya en cola o activo, ignorado:', newEvent.id);
            return;
          }

          console.log('[Overlay] Nuevo evento recibido en tiempo real:', newEvent);
          console.log('[Overlay] Avatar URL del evento:', newEvent.sender_avatar_url);
          queueRef.current.push(newEvent);

          if (!isPlayingRef.current) {
            playNextRef.current();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stream_events' },
        (payload: { new: StreamEvent }) => {
          const updatedEvent = payload.new;
          
          if (updatedEvent.played) {
            console.log('[Overlay] Evento marcado como jugado en tiempo real:', updatedEvent.id);
            
            // 1. Quitar de la cola local
            const originalLength = queueRef.current.length;
            queueRef.current = queueRef.current.filter((e) => e.id !== updatedEvent.id);
            if (queueRef.current.length !== originalLength) {
              console.log(`[Overlay] Evento ${updatedEvent.id} removido de la cola local.`);
            }

            // 2. Si es el evento que se está reproduciendo actualmente, detenerlo
            if (currentEventRef.current && currentEventRef.current.id === updatedEvent.id) {
              console.log('[Overlay] El evento activo fue marcado como jugado externamente (ej: vaciar cola). Deteniendo.');
              
              if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                audioPlayerRef.current.src = '';
              }
              
              setActiveAnimation(null);
              setParticles([]);
              setIsPlaying(false);
              isPlayingRef.current = false;
              setCurrentEvent(null);
              currentEventRef.current = null;
              
              // Continuar con el siguiente en la cola filtrada (con un pequeño delay)
              setTimeout(() => {
                playNextRef.current();
              }, 100);
            }
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          if (!warnedRealtimeRef.current) {
            console.log('[Overlay] Suscrito a eventos de stream en vivo');
            warnedRealtimeRef.current = true;
          }
        }
      });

    return () => {
      void supabase.removeChannel(settingsChannel);
      void supabase.removeChannel(eventsChannel);
    };
  }, [authorized, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-[#FFD700] flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2 text-xs font-black uppercase">Cargando Overlay OBS...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black text-red-500 flex flex-col items-center justify-center p-6 font-sans text-center">
        <ShieldAlert className="w-12 h-12 mb-3" />
        <h1 className="font-black text-2xl uppercase">Enlace de overlay inválido</h1>
        <p className="text-sm font-semibold text-gray-400 mt-2 max-w-sm">
          Copia el enlace del overlay desde el panel de administración y úsalo como fuente de navegador en OBS.
        </p>
      </div>
    );
  }

  const isMuted = settings?.is_muted;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-transparent select-none pointer-events-none font-sans flex items-center justify-center"
    >
      {/* Hidden audio element — fuera del canvas para no afectar el layout */}
      <audio
        ref={audioPlayerRef}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        className="hidden"
      />

      {/* Canvas real 720×1280 escalado al viewport 9:16 */}
      <div
        ref={aspectContainerRef}
        className={`relative aspect-[9/16] h-full overflow-hidden ${
          isDebug ? 'outline outline-4 outline-dashed outline-[#FFD700]/60' : ''
        }`}
        style={{ background: 'transparent' }}
      >
        {/*
         * OverlayCanvas en mode='obs' se auto-escala para caber
         * dentro del contenedor 9:16, evitando overflow y clipping.
         */}
        <div className="absolute inset-0 flex items-center justify-center">
          <OverlayCanvas
            mode="obs"
            scale={canvasFitScale}
            settings={settings ?? {}}
            event={isPlaying && currentEvent ? currentEvent : null}
            animation={activeAnimation}
            particles={particles}
            isMuted={!!isMuted}
            needsInteraction={needsInteraction}
            onInteraction={() => {
              remoteLog('INFO', 'Interacción detectada. Desbloqueando audio y reanudando cola...');
              setNeedsInteraction(false);
              if (audioPlayerRef.current) {
                audioPlayerRef.current.play().catch(() => {});
              }
              setTimeout(() => { playNextRef.current(); }, 100);
            }}
            mediaPosition={currentEvent?.type === 'image' && imagePositions.length > 0 ? imagePositions[imagePositionIndex] : undefined}
          />
        </div>
      </div>

      <style>{`
        body {
          background: transparent !important;
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
}
