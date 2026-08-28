"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Award,
  ChevronLeft,
  LogOut,
  X,
  ArrowRight,
  Search
} from 'lucide-react';

import { CATEGORIES as DEFAULT_CATEGORIES } from '@/src/data/categories';
import { CATEGORY_FINALISTS } from '@/src/data/categories_phase2';
import { VoteState, Category } from '@/src/types';
import EggAnimation from '@/components/EggAnimation';
import ShareCard from '@/components/ShareCard';
import Confetti from '@/components/Confetti';
import RobloxOnboarding from '@/components/RobloxOnboarding';
import { soundManager } from '@/lib/sound';
import { supabase } from '@/lib/supabaseClient';
import { buildAccessPath } from '@/lib/authRouting';
import { Session } from '@supabase/supabase-js';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type ScreenState = 'landing' | 'auth' | 'hatching' | 'welcome' | 'intro' | 'voting' | 'intermission' | 'submitting' | 'final' | 'results';

type PublicNominee = {
  id: string;
  name: string;
  profileImageUrl: string | null;
};

type ResultCategory = {
  id: number;
  title: string;
  emoji: string;
  description: string;
  totalVotes: number;
  nominees: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
    roblox_user: string | null;
    votes: number;
  }[];
};

type RobloxProfileState = {
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  tiktokUser: string | null;
  linkStatus: string;
  rejectionReason: string | null;
} | null;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const VOTING_DEADLINE = new Date("2026-06-16T19:30:00-05:00").getTime();

export default function LandingPage() {
  const phase = Number(process.env.NEXT_PUBLIC_VOTING_PHASE || 1);
  const warnedVotesReadRef = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<ScreenState>('results');
  const [results, setResults] = useState<ResultCategory[]>([]);
  const [resultsLoading, setResultsLoading] = useState<boolean>(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [votes, setVotes] = useState<VoteState>({});
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  
  const reorderMvpLast = (list: Category[]) => {
    const copy = [...list];
    const mvpIndex = copy.findIndex((c) => c.id === 1);
    if (mvpIndex >= 0) {
      const [mvp] = copy.splice(mvpIndex, 1);
      copy.push(mvp);
    }
    return copy;
  };

  const [categories, setCategories] = useState(() => reorderMvpLast(DEFAULT_CATEGORIES));
  const [selectedNomineeId, setSelectedNomineeId] = useState<string | null>(null);
  const [nominees, setNominees] = useState<PublicNominee[]>([]);
  const [nomineesLoading, setNomineesLoading] = useState<boolean>(false);
  const [nomineeSearch, setNomineeSearch] = useState<string>('');
  const [muted, setMuted] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [robloxProfile, setRobloxProfile] = useState<RobloxProfileState>(null);
  const [isWebView, setIsWebView] = useState<boolean>(false);
  const [webViewBrand, setWebViewBrand] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Modal states
  const [miloModalOpen, setMiloModalOpen] = useState<boolean>(false);
  const [dateModalOpen, setDateModalOpen] = useState<boolean>(false);
  const [robloxOnboardingOpen, setRobloxOnboardingOpen] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const checkRobloxProfile = useCallback(async (session: Session | null) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/profile/verify-roblox', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.profile) {
        setRobloxProfile({
          displayName: data.profile.roblox_display_name || data.profile.roblox_user || data.displayName || 'Pollito',
          avatarUrl: data.profile.roblox_avatar_url || data.avatarUrl || null,
          username: data.profile.roblox_user || null,
          tiktokUser: data.profile.tiktok_user || null,
          linkStatus: data.profile.link_status || 'none',
          rejectionReason: data.profile.rejection_reason || null,
        });
      } else if (data.displayName) {
        setRobloxProfile({
          displayName: data.displayName,
          avatarUrl: data.avatarUrl || null,
          username: null,
          tiktokUser: null,
          linkStatus: 'none',
          rejectionReason: null,
        });
      }

      // If profile is not complete, show onboarding modal
      if (!data.isComplete) {
        setRobloxOnboardingOpen(true);
      }
    } catch (err) {
      console.error('Error checking Roblox profile:', err);
    }
  }, []);

  const fetchUserVotes = useCallback(async (userId: string, shouldRedirect: boolean = false): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('category_id, nominee_id')
        .eq('user_id', userId)
        .eq('phase', phase);

      if (error) {
        const msg = (error.message || '').toLowerCase();
        const isRlsReadError =
          error.code === '42501' ||
          msg.includes('permission denied') ||
          msg.includes('row-level security');

        if (isRlsReadError) {
          // Avoid spamming in dev StrictMode; this is configuration, not app flow failure.
          if (!warnedVotesReadRef.current) {
            console.warn(
              'No se pudieron leer los votos por politicas RLS. Agrega policy SELECT para votes.',
              { code: error.code, message: error.message }
            );
            warnedVotesReadRef.current = true;
          }
          setVotes({});
          return false;
        }

        throw error;
      }

      if (data && data.length > 0) {
        const loadedVotes: VoteState = {};
        (data as { category_id: number; nominee_id: string }[]).forEach((v) => {
          loadedVotes[v.category_id] = v.nominee_id;
        });
        setVotes(loadedVotes);

        const firstMissingCategoryIndex = categories.findIndex((category) => !loadedVotes[category.id]);
        if (firstMissingCategoryIndex >= 0) {
          setCurrentIdx(firstMissingCategoryIndex);
          setSelectedNomineeId(loadedVotes[categories[firstMissingCategoryIndex].id] || null);
        }

        // If they voted in everything, jump to final
        if (data.length >= categories.length) {
          if (shouldRedirect) {
            setScreen('final');
          }
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error('Error fetching user votes:', err);
      return false;
    }
  }, [phase, categories]);

  const sessionRef = useRef<Session | null>(null);
  const screenRef = useRef<ScreenState>('landing');

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Interactive triggers
  const [burstActive, setBurstActive] = useState<boolean>(false);
  const continuousConfetti = screen === 'final';



  // Countdown Timer state for June 16, 2026, 7:30 PM (19:30:00) GMT-5
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOver: false
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent.toLowerCase();
    const isInstagram = ua.includes('instagram');
    const isTikTok = ua.includes('tiktok') || ua.includes('musical_ly');
    const isFacebook = ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab');
    const isWhatsApp = ua.includes('whatsapp');
    const isAndroidWebView = ua.includes('wv') || (ua.includes('android') && ua.includes('version/'));
    const isIosWebView = (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) && !ua.includes('safari') && !ua.includes('crios') && !ua.includes('fxios');
    
    Promise.resolve().then(() => {
      if (isInstagram) {
        setIsWebView(true);
        setWebViewBrand('Instagram');
      } else if (isTikTok) {
        setIsWebView(true);
        setWebViewBrand('TikTok');
      } else if (isFacebook) {
        setIsWebView(true);
        setWebViewBrand('Facebook');
      } else if (isWhatsApp) {
        setIsWebView(true);
        setWebViewBrand('WhatsApp');
      } else if (isAndroidWebView || isIosWebView) {
        setIsWebView(true);
        setWebViewBrand('Navegador Interno');
      }
    });
  }, []);

  // Check user session and fetch existing votes on mount
  useEffect(() => {
    const initializeSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      // Limpiar el hash de la URL después de consumir el token de sesión
      // para evitar que Supabase re-parsee un token expirado en cada navegación
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      if (!session) return;

      // Fetch admin status
      try {
        const statusRes = await fetch('/api/interviews/my-status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIsAdmin(!!statusData.is_admin);
        }
      } catch {}

      // Check if user has completed their Roblox profile
      await checkRobloxProfile(session);

      const isCurrentlyClosed = new Date().getTime() >= VOTING_DEADLINE;
      const hasFinishedVoting = await fetchUserVotes(session.user.id, !isCurrentlyClosed);
      if (!hasFinishedVoting && !isCurrentlyClosed) {
        setScreen('hatching');
      }
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, nextSession: Session | null) => {
      const wasAlreadyLoggedIn = !!sessionRef.current;
      const isInsideVotingFlow = ['hatching', 'welcome', 'intro', 'voting', 'intermission', 'submitting'].includes(screenRef.current);

      setSession(nextSession);

      // Limpiar hash de URL stale también en cambios de estado de auth
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      if (nextSession) {
        setAuthError(null);

        // Evitar que refrescos de token en segundo plano o enfoque de ventana reinicien la pantalla o interrumpan la votación
        if (event === 'TOKEN_REFRESHED' || wasAlreadyLoggedIn || isInsideVotingFlow) {
          return;
        }

        // Check if user has completed their Roblox profile
        await checkRobloxProfile(nextSession);

        const isCurrentlyClosed = new Date().getTime() >= VOTING_DEADLINE;
        const hasFinishedVoting = await fetchUserVotes(nextSession.user.id, !isCurrentlyClosed);
        if (!hasFinishedVoting && !isCurrentlyClosed) {
          setScreen((prev) => (prev === 'landing' || prev === 'auth' ? 'hatching' : prev));
        }
      } else {
        setVotes({});
        const isCurrentlyClosed = new Date().getTime() >= VOTING_DEADLINE;
        setScreen((current) =>
          current === 'auth' ? current : isCurrentlyClosed ? 'results' : 'landing',
        );
      }
    });

    return () => subscription.unsubscribe();
  }, [checkRobloxProfile, fetchUserVotes]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch('/api/results');
        const data = await res.json();
        if (data.results) {
          setResults(data.results);
        } else if (data.error) {
          setResultsError(data.error);
        }
      } catch (err) {
        setResultsError(err instanceof Error ? err.message : 'Error al cargar resultados');
      } finally {
        setResultsLoading(false);
      }
    };

    fetchResults();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, title, emoji, description')
        .order('id', { ascending: true });

      if (error || !data || data.length === 0) {
        console.error('Error loading categories from Supabase:', error);
        setCategories(reorderMvpLast(DEFAULT_CATEGORIES));
        return;
      }

      const mapped = (data as { id: number; title: string; emoji: string; description: string }[]).map((category) => ({
        id: category.id,
        title: category.title,
        emoji: category.emoji,
        description: category.description,
        nominees: [],
      }));
      setCategories(reorderMvpLast(mapped));
    };

    void loadCategories();
  }, []);

  useEffect(() => {
    const target = VOTING_DEADLINE;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true });
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days: d, hours: h, minutes: m, seconds: s, isOver: false });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadNominees = async () => {
      setNomineesLoading(true);

      try {
        const response = await fetch('/api/nominees');
        if (!response.ok) {
          throw new Error('Failed to fetch nominees');
        }
        const data = await response.json();
        const nomineesList = data.nominees || [];
        setNominees(
          (nomineesList as { id: string; roblox_user: string; nickname: string | null; profile_image_url: string | null }[]).map((nominee) => ({
            id: nominee.id,
            name: String(nominee.nickname || nominee.roblox_user || ''),
            profileImageUrl: nominee.profile_image_url || null,
          }))
        );
      } catch (err) {
        console.error('Error loading public nominees from API:', err);
        setNominees([]);
      } finally {
        setNomineesLoading(false);
      }
    };

    void loadNominees();
  }, []);

  // Sync mute state with sound utility
  const toggleMuted = () => {
    const newMuted = soundManager.toggleMute();
    setMuted(newMuted);
  };

  const handleStartVotingClick = () => {
    soundManager.playPop();
    if (!session) {
      setAuthError(null);
      setScreen('auth');
    } else if (robloxProfile?.linkStatus !== 'approved') {
      setRobloxOnboardingOpen(true);
    } else {
      const firstMissingCategoryIndex = categories.findIndex((category) => !votes[category.id]);
      if (firstMissingCategoryIndex >= 0) {
        setCurrentIdx(firstMissingCategoryIndex);
        setSelectedNomineeId(votes[categories[firstMissingCategoryIndex].id] || null);
      }
      setScreen('hatching');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    window.location.assign(buildAccessPath(`${window.location.pathname}${window.location.search}`));
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    soundManager.playPop();
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Error al copiar el enlace:', err);
      });
  };

  const handleLogout = async () => {
    soundManager.playPop();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesion:', {
        message: error.message,
        code: error.code,
      });
    }
  };

  // Restart/reset voting logic
  const handleRestart = () => {
    soundManager.playPop();
    setCurrentIdx(0);
    setSelectedNomineeId(votes[categories[0]?.id] || null);
    setNomineeSearch('');
    setAuthError(null);
    const isCurrentlyClosed = new Date().getTime() >= VOTING_DEADLINE;
    if (isCurrentlyClosed) {
      setScreen('results');
    } else {
      // Si el usuario tiene sesión activa, volver al flujo de votación
      // en vez de la pantalla de landing (que es para usuarios no autenticados)
      setScreen(session ? 'hatching' : 'landing');
    }
  };

  // Navigate back step-by-step
  const handleBack = () => {
    soundManager.playPop();

    if (screen === 'final') {
      const isCurrentlyClosed = new Date().getTime() >= VOTING_DEADLINE;
      setScreen(isCurrentlyClosed ? 'results' : 'landing');
      return;
    }

    if (screen === 'welcome') {
      const isCurrentlyClosed = new Date().getTime() >= VOTING_DEADLINE;
      setScreen(isCurrentlyClosed ? 'results' : 'landing');
      return;
    }

    if (screen === 'intro') {
      if (currentIdx > 0) {
        const prevIdx = currentIdx - 1;
        setCurrentIdx(prevIdx);
        setSelectedNomineeId(votes[categories[prevIdx].id] || null);
        setNomineeSearch('');
        setScreen('voting');
      } else {
        setScreen('welcome');
      }
      return;
    }

    if (screen === 'voting') {
      setScreen('intro');
      return;
    }

    if (screen === 'intermission') {
      setSelectedNomineeId(votes[categories[currentIdx].id] || null);
      setScreen('voting');
      return;
    }

    // Fallback: reset all
    handleRestart();
  };

  const normalizedNomineeSearch = normalizeText(nomineeSearch.trim());

  // Filter nominees for Phase 2 based on categories_phase2.ts
  const currentCategoryId = categories[currentIdx]?.id;
  const allowedNomineeIds = phase === 2 && currentCategoryId ? (CATEGORY_FINALISTS[currentCategoryId] || []) : [];

  const phaseFilteredNominees = phase === 2
    ? nominees.filter((nominee) => allowedNomineeIds.includes(nominee.id))
    : nominees;

  const activeNominees = normalizedNomineeSearch
    ? phaseFilteredNominees.filter((nominee) => normalizeText(nominee.name).includes(normalizedNomineeSearch))
    : phaseFilteredNominees;

  // Set of unique nominee IDs in the active phase
  const activePhaseNomineeIds = React.useMemo(() => {
    if (phase === 2) {
      const ids = new Set<string>();
      Object.values(CATEGORY_FINALISTS).forEach((list) => {
        (list as string[]).forEach((id: string) => ids.add(id));
      });
      return ids;
    }
    return new Set(nominees.map((n) => n.id));
  }, [nominees, phase]);

  const totalNomineesCount = activePhaseNomineeIds.size;

  // Vote nomination selection
  const handleSelectNominee = (nomineeId: string) => {
    soundManager.playPop();
    setSelectedNomineeId(nomineeId);
  };

  // Confirm selected vote and advance
  const handleConfirmVote = async () => {
    if (!selectedNomineeId || !session) return;

    if (new Date().getTime() >= VOTING_DEADLINE) {
      setAuthError('Las votaciones ya han cerrado. ¡Gracias por participar!');
      setScreen('landing');
      return;
    }

    soundManager.playPop();
    setBurstActive(true);
    setTimeout(() => {
      setBurstActive(false);
    }, 1500);

    const categoryId = categories[currentIdx].id;

    // Refrescar la sesión antes de guardar para asegurar un JWT válido
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    if (!freshSession) {
      setAuthError('Tu sesión expiró. Por favor, volvé a iniciar sesión.');
      setScreen('landing');
      return;
    }
    setSession(freshSession);

    // Borrar el voto existente para esta categoría si lo hubiera, para evitar políticas de UPDATE en RLS (que no están configuradas)
    await supabase
      .from('votes')
      .delete()
      .eq('user_id', freshSession.user.id)
      .eq('category_id', categoryId)
      .eq('phase', phase);

    // Insertar el nuevo voto
    const { error } = await supabase
      .from('votes')
      .insert({
        user_id: freshSession.user.id,
        nominee_id: selectedNomineeId,
        category_id: categoryId,
        phase: phase,
      });

    if (error) {
      console.error('Error saving vote:', error);
      setAuthError('Error al guardar tu voto. Intentalo de nuevo.');
      return;
    }

    const newVotes = { ...votes, [categoryId]: selectedNomineeId };
    setVotes(newVotes);

    setTimeout(() => {
      const nextIdx = currentIdx + 1;
      const totalCategories = categories.length;

      // Check for emotional intermissions
      if ((nextIdx === 3 || nextIdx === 6 || nextIdx === 9) && nextIdx < totalCategories) {
        setSelectedNomineeId(newVotes[categories[nextIdx]?.id] || null);
        setScreen('intermission');
      } else if (nextIdx >= totalCategories) {
        setSelectedNomineeId(null);
        setScreen('submitting');
      } else {
        setCurrentIdx(nextIdx);
        setSelectedNomineeId(newVotes[categories[nextIdx]?.id] || null);
        setScreen('intro');
      }
    }, 700);
  };

  const skipIntermission = () => {
    soundManager.playPop();
    const nextIdx = currentIdx + 1;
    setCurrentIdx(nextIdx);
    setSelectedNomineeId(votes[categories[nextIdx]?.id] || null);
    setScreen('intro');
  };

  // Trigger continuous confetti on final screen
  useEffect(() => {
    if (screen === 'final') {
      soundManager.playSuccess();
    }
  }, [screen]);

  // Transition from submitted to final screen
  useEffect(() => {
    if (screen === 'submitting') {
      const timer = setTimeout(() => {
        setScreen('final');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  return (
    <div id="app-root-container" className="min-h-screen bg-[#FDFBF7] text-[#2D3139] flex flex-col justify-between relative selection:bg-[#FFB000] selection:text-black overflow-hidden font-sans">

      {/* Global Design System Header (Desktop Only for Space Saving on Mobile) */}
      <div className="hidden md:block w-full">
        <Header
          session={session}
          isAdmin={isAdmin}
          showMobileToggle={false}
        />
      </div>

      {/* Dynamic Confetti triggers */}
      <Confetti active={continuousConfetti} type="continuous" />
      <Confetti active={burstActive} type="burst" />

      {/* Main Container with split desktop view and central mock device card */}
      <main className="flex-grow w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-center gap-0 md:gap-12 relative z-20 my-auto md:py-4 py-0 h-full md:h-auto md:px-4 px-0">

        {/* LEFT COLUMN: Modern Neobrutalist Title & Badges (Visible on Desktop) */}
        <div className="hidden md:flex flex-col justify-center space-y-6 w-1/2 text-left shrink-0">
          <div className="self-start">
            <Badge variant={phase === 2 ? 'danger' : 'admin'} className="text-sm px-4 py-2 transform -rotate-2">
              {phase === 2 ? '🗳️ FASE 2: GRAN FINAL' : '1ER ANIVERSARIO 🐣'}
            </Badge>
          </div>
          <h1 className="text-6xl font-bold text-black leading-none uppercase tracking-tighter font-display">
            The <br />
            <span className="text-[#0369A1] bg-[#E0F2FE] border-4 border-black px-4 inline-block rounded-2xl rotate-1 my-2">Pollitos</span> <br />
            Awards
          </h1>
          <p className="text-xl font-bold text-gray-700 leading-tight">
            {phase === 2 ? (
              <>¡Llegamos a la Gran Final! <br />Vota por los 5 más elegidos de cada categoría.</>
            ) : (
              <>¡Es hora de celebrar un año de streams! <br />Vota por tus amigos y compañeros de Roblox.</>
            )}
          </p>

          {/* Desktop Live Countdown Banner */}
          <Card variant="light" className="flex flex-col xl:flex-row items-center justify-between gap-4 p-5">
            <div className="text-center sm:text-left flex-grow">
              <div className="mb-2">
                <Badge variant="success">📢 Gala en vivo en TikTok</Badge>
              </div>
              <p className="font-sans text-xs font-semibold text-gray-600">
                El gran live de premiación será el martes 16 de Junio a las 7:30 PM (GMT-5). ¡Te esperamos!
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
                {timeLeft.isOver ? (
                  <span className="animate-pulse text-lg text-orange-600 font-bold">🔴 ¡ESTAMOS EN VIVO EN TIKTOK!</span>
                ) : (
                  <>
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-2xl font-black text-black leading-none">{timeLeft.days}</span>
                      <span className="text-[9px] uppercase font-bold text-gray-500 font-sans">Días</span>
                    </div>
                    <span className="font-mono text-xl font-black text-[#FFB000] leading-none">:</span>
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-2xl font-black text-black leading-none">{String(timeLeft.hours).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase font-bold text-gray-500 font-sans">Horas</span>
                    </div>
                    <span className="font-mono text-xl font-black text-[#FFB000] leading-none">:</span>
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-2xl font-black text-black leading-none">{String(timeLeft.minutes).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase font-bold text-gray-500 font-sans">Mins</span>
                    </div>
                    <span className="font-mono text-xl font-black text-[#FFB000] leading-none">:</span>
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-2xl font-black text-black leading-none">{String(timeLeft.seconds).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase font-bold text-gray-500 font-sans">Segs</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <a
              href="https://www.tiktok.com/@milumon_gaming"
              target="_blank"
              rel="noopener noreferrer"
              className="decoration-transparent block shrink-0"
            >
              <Button variant="primary" size="md">
                🚀 IR AL LIVE
              </Button>
            </a>
          </Card>

          <div className="flex items-center space-y-4 flex-col pt-2">
            <div className="flex space-x-4 w-full">
              <Card variant="light" className="flex-1 p-4">
                <p className="text-xs uppercase font-bold text-gray-500 font-sans">Categorías</p>
                <p className="text-3xl font-bold font-display text-black">{categories.length}</p>
              </Card>
              <Card variant="light" className="flex-1 p-4">
                <p className="text-xs uppercase font-bold text-gray-500 font-sans">Pollitos</p>
                <p className="text-3xl font-bold font-display text-black">
                  {nomineesLoading ? '...' : totalNomineesCount}
                </p>
              </Card>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Smartphone Frame Mockup on Desktop, Native Fullscreen on Mobile */}
        <div className="w-full h-full md:max-w-[365px] md:h-[690px] bg-[#FDFBF7] rounded-none md:rounded-[2.8rem] border-none md:border-[8px] md:border-solid md:border-black shadow-none md:shadow-[16px_16px_0px_0px_#FFB000] relative flex flex-col overflow-hidden text-black md:shrink-0">

          {/* Top Speaker Notch Block */}
          <div className="hidden md:flex h-5 bg-black w-28 mx-auto rounded-b-2xl mb-2 items-center justify-center shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
          </div>

          {/* Header Progress Tag & Audio Toggle inside phone frame */}
          <div className="px-4 py-1 md:px-5 md:py-1.5 flex items-center justify-between gap-2 bg-[#FCF9F2] border-b-2 border-black/5 md:border-gray-100 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {screen !== 'landing' && screen !== 'results' && screen !== 'hatching' && screen !== 'submitting' && (
                <button
                  id="back-to-landing"
                  onClick={handleBack}
                  className="flex items-center gap-1 bg-white hover:bg-[#FCF9F2] border-2 border-black rounded-lg px-2.5 py-1 text-xs font-sans font-bold text-black cursor-pointer active:scale-95 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[3]" />
                  {(screen === 'welcome' || (screen === 'intro' && currentIdx === 0)) ? 'INICIO' : 'ATRÁS'}
                </button>
              )}

              {screen === 'landing' && (
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400 font-comic animate-pulse whitespace-nowrap">
                  • 1 AÑO DE STREAMS
                </span>
              )}

              {/* Steps text inside phone */}
              {screen === 'voting' && (
                <span className={`ml-1 text-[10px] md:text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${phase === 2
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-[#FEF3C7] text-[#D97706] border-[#FCD34D]'
                  }`}>
                  PASO {currentIdx + 1 < 10 ? `0${currentIdx + 1}` : currentIdx + 1}/{categories.length}
                  {phase === 2 && ' • F2'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {session && (
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="h-8 rounded-lg bg-white hover:bg-[#FCF9F2] border-2 border-black px-2.5 flex items-center justify-center gap-1 text-[10px] font-sans font-bold uppercase text-black cursor-pointer active:scale-95 transition-all"
                  title="Cerrar sesion"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Salir</span>
                </button>
              )}

              <button
                id="audio-toggle-btn"
                onClick={toggleMuted}
                className="w-8 h-8 rounded-lg bg-white hover:bg-[#FCF9F2] border-2 border-black flex items-center justify-center text-black select-none cursor-pointer active:scale-95 transition-all"
                title={muted ? 'Activar sonido' : 'Silenciar'}
              >
                {muted ? <VolumeX className="w-4 h-4 text-gray-500" /> : <Volume2 className="w-4 h-4 text-black font-bold animate-bounce" style={{ animationDuration: '3s' }} />}
              </button>
            </div>
          </div>

          {/* View Container inside Smartphone Viewport */}
          <div className="flex-grow overflow-y-auto bg-[#FDFBF7] p-3 md:p-4 flex flex-col relative z-20 scrollbar-thin">
            <AnimatePresence mode="wait">

              {/* SCREEN 0: RESULTS */}
              {screen === 'results' && (
                (() => {
                  // Calculate user hits
                  let userHits = 0;
                  let hasVotedAny = false;
                  if (results && results.length > 0 && votes && Object.keys(votes).length > 0) {
                    results.forEach((category) => {
                      const winner = category.nominees?.[0];
                      const userVote = votes[category.id];
                      if (userVote) {
                        hasVotedAny = true;
                        if (winner && userVote === winner.id) {
                          userHits++;
                        }
                      }
                    });
                  }

                  return (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col min-h-full py-1 text-black"
                    >
                      <div className="text-center mb-4 mt-2">
                        <div className="w-14 h-14 bg-[#FFB000] border-4 border-black rounded-full flex items-center justify-center text-3xl mx-auto shadow-md animate-bounce relative mb-2">
                          🏆
                          <div className="absolute inset-0 border-2 border-dashed border-black rounded-full animate-pulse" />
                        </div>
                        <h2 className="font-display text-2xl text-black tracking-normal uppercase leading-none">
                          🏆 Ganadores 🏆
                        </h2>
                        <p className="font-sans text-[10px] text-orange-600 uppercase tracking-widest font-bold mt-1.5 leading-snug">
                          ¡Resultados Oficiales 2026!
                        </p>
                      </div>

                      {/* Summary of Hits Banner */}
                      {session && hasVotedAny && (
                        <div className="bg-[#E0F2FE] border-4 border-black rounded-2xl p-3.5 mb-3.5 shadow-[4px_4px_0_0_#0369A1] text-center">
                          <span className="text-2xl">🎯</span>
                          <p className="font-display text-base font-bold uppercase text-[#0369A1] leading-none mt-1.5">
                            ¡Conseguiste acertar {userHits} de {results.length} ganadores!
                          </p>
                          <p className="font-sans text-[10px] text-[#0369A1] font-bold mt-1.5 uppercase leading-tight">
                            {userHits === results.length 
                              ? '🏆 ¡INCREÍBLE! ¡ERES UN ADIVINO EXPERTO! 🐣' 
                              : userHits >= 8 
                              ? '🔥 ¡Excelente puntería, pollito! 💛' 
                              : userHits >= 6 
                              ? '✨ ¡Muy buena puntería! ¡Más de la mitad! 👍' 
                              : userHits === 5 
                              ? '✨ ¡Le pegaste justo a la mitad! 👍' 
                              : userHits >= 3 
                              ? '✨ ¡Bastante bien! ¡Casi la mitad! 👍' 
                              : '🐣 ¡A la próxima le pegás a más! ¡Gracias por participar!'}
                          </p>
                        </div>
                      )}

                      {resultsLoading ? (
                        <div className="flex-grow flex flex-col items-center justify-center py-12">
                          <div className="w-8 h-8 border-4 border-black border-t-[#FFB000] rounded-full animate-spin mb-3" />
                          <p className="font-sans text-xs font-bold uppercase text-gray-500">Cargando ganadores...</p>
                        </div>
                      ) : resultsError ? (
                        <div className="bg-red-100 border-4 border-black p-4 rounded-2xl text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)] my-4 text-red-600">
                          <p className="font-sans text-xs font-bold text-red-600 uppercase mb-2">⚠️ Error al cargar</p>
                          <p className="text-xs font-bold text-gray-700">{resultsError}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 mb-4 flex-grow">
                          {results.map((category) => {
                            const isExpanded = expandedCategory === category.id;
                            const winner = category.nominees?.[0];
                            const userVoteId = votes[category.id];
                            const hasVotedThis = !!userVoteId;
                            const isHit = winner && userVoteId === winner.id;
                            const votedNominee = category.nominees?.find((n) => n.id === userVoteId);
                            const votedName = votedNominee ? votedNominee.nickname : 'Tu elección';

                            return (
                              <div key={category.id} className="bg-white border-4 border-black rounded-2xl p-3 shadow-[4px_4px_0_0_#FFB000] transition-all hover:scale-[1.01]">
                                <div 
                                  onClick={() => {
                                    soundManager.playPop();
                                    setExpandedCategory(isExpanded ? null : category.id);
                                  }}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-2xl shrink-0">{category.emoji}</span>
                                    <div className="min-w-0">
                                      <p className="font-display text-xs font-bold uppercase tracking-wide truncate text-black">{category.title}</p>
                                      <p className="text-[10px] text-gray-500 font-bold font-sans uppercase">
                                        {category.totalVotes} votos totales
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[#FFB000] text-sm font-black font-sans ml-2">
                                    {isExpanded ? '▲' : '▼'}
                                  </span>
                                </div>

                                {/* Winner summary */}
                                {winner && (
                                  <div className="mt-2.5 bg-[#FEF3C7] border-2 border-black rounded-xl p-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-10 h-10 rounded-full overflow-hidden relative flex items-center justify-center bg-yellow-100 border border-black/10 shrink-0">
                                        {winner.profile_image_url ? (
                                          <Image
                                            src={winner.profile_image_url}
                                            alt={winner.nickname}
                                            fill
                                            sizes="40px"
                                            unoptimized
                                            className="w-[38px] h-[38px] rounded-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-lg select-none">🐣</span>
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-bold text-sm text-black font-sans flex items-center gap-1">
                                          👑 {winner.nickname}
                                        </p>
                                        <p className="text-[8px] font-bold uppercase tracking-wider text-orange-600 font-sans">
                                          Ganador/a
                                        </p>
                                      </div>
                                    </div>
                                    <div className="bg-[#FFB000] border-2 border-black text-black px-2 py-0.5 rounded-lg text-xs font-mono font-bold shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                                      {winner.votes} {winner.votes === 1 ? 'voto' : 'votos'}
                                    </div>
                                  </div>
                                )}

                                {/* Match comparison badge */}
                                {session && hasVotedThis && (
                                  <div className={`mt-2 border-2 border-dashed p-2 rounded-xl flex items-center justify-between text-[11px] font-bold font-sans ${
                                    isHit 
                                      ? 'bg-[#DCFCE7] border-green-400 text-[#15803D]' 
                                      : 'bg-white border-gray-300 text-gray-600'
                                  }`}>
                                    <span className="truncate pr-1">
                                      {isHit ? '🎯 ¡Le atinaste!' : `🗳️ Votaste por:`} <span className="font-bold underline">{votedName}</span>
                                    </span>
                                    <span className="font-sans text-[9px] uppercase font-bold shrink-0">
                                      {isHit ? '¡ACERTASTE! 🎉' : 'VOTO REGISTRADO'}
                                    </span>
                                  </div>
                                )}

                                {/* Expanded positions list */}
                                {isExpanded && (
                                  <div className="mt-3 border-t-2 border-black/10 pt-3 space-y-2">
                                    <p className="font-sans text-[9px] uppercase font-bold text-gray-500 tracking-wider mb-1">Posiciones completas:</p>
                                    {category.nominees.map((nominee, idx: number) => {
                                      const isWinner = idx === 0;
                                      return (
                                        <div key={nominee.id} className={`flex items-center justify-between p-1.5 rounded-lg border-2 ${isWinner ? 'bg-[#FEF3C7] border-black' : 'bg-white border-gray-100'}`}>
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-mono text-xs font-bold text-gray-400 w-4 text-center">
                                              {isWinner ? '👑' : `${idx + 1}`}
                                            </span>
                                            <div className="w-6 h-6 rounded-full overflow-hidden relative flex items-center justify-center bg-gray-50 border border-black/5 shrink-0">
                                              {nominee.profile_image_url ? (
                                                <Image
                                                  src={nominee.profile_image_url}
                                                  alt={nominee.nickname}
                                                  fill
                                                  sizes="24px"
                                                  unoptimized
                                                  className="w-6 h-6 rounded-full object-cover"
                                                />
                                              ) : (
                                                <span className="text-xs select-none">🐣</span>
                                              )}
                                            </div>
                                            <span className={`text-xs font-bold truncate text-slate-800 ${isWinner ? 'font-bold text-[#FFB000]' : 'font-medium'}`}>
                                              {nominee.nickname}
                                            </span>
                                          </div>
                                          <span className="text-xs font-mono font-bold text-slate-700 bg-gray-50 border border-black/5 px-1.5 py-0.5 rounded">
                                            {nominee.votes} {nominee.votes === 1 ? 'voto' : 'votos'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!session ? (
                        <button
                          id="results-login-btn"
                          onClick={() => setScreen('auth')}
                          className="w-full py-3 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display font-bold text-xs tracking-wider rounded-xl border-4 border-black select-none cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 uppercase shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-2 focus:outline-none shrink-0"
                        >
                          🔐 Iniciá sesión con Google
                        </button>
                      ) : (
                        <button
                          id="view-my-card-btn"
                          onClick={() => setScreen('final')}
                          className="w-full py-3 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display font-bold text-xs tracking-wider rounded-xl border-4 border-black select-none cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 uppercase shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-2 focus:outline-none shrink-0"
                        >
                          📋 Ver mi Tarjeta de Votación
                        </button>
                      )}
                      
                      {/* Spacing at the bottom to avoid being flush with the floor */}
                      <div className="h-10 w-full shrink-0" />
                    </motion.div>
                  );
                })()
              )}

              {/* SCREEN 1: LANDING */}
              {screen === 'landing' && (
                <motion.div
                  key="landing"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center text-center h-full py-1"
                >
                  <div className="w-full flex flex-col items-center pt-2">
                    {/* Mobile rotated badge */}
                    <div className={`inline-block font-bold px-3.5 py-1.5 text-xs transform -rotate-2 border-3 border-black mb-3 md:hidden rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,1)] ${phase === 2 ? 'bg-red-600 text-white' : 'bg-[#FFB000] text-black'}`}>
                      {phase === 2 ? '🗳️ FASE 2: GRAN FINAL' : '1ER ANIVERSARIO 🐣'}
                    </div>

                    {/* Live countdown header */}
                    <div className="w-full bg-[#FFB000] text-black border-4 border-black rounded-2xl p-2 mb-3.5 shadow-[3px_3px_0_0_rgba(0,0,0,1)] flex items-center justify-between gap-1.5 shrink-0">
                      <div className="flex flex-col items-start leading-none pl-1 text-left">
                        <span className="text-[8px] uppercase font-bold text-black/80 font-sans tracking-wider">
                          🎁 ¡FALTA PARA EL LIVE!
                        </span>
                        <div className="flex items-center gap-0.5 mt-1 font-mono text-[13px] font-black">
                          {timeLeft.isOver ? (
                            <span className="animate-pulse text-[10px] text-red-600">🔴 ¡ESTAMOS EN VIVO!</span>
                          ) : (
                            <>
                              <span>{timeLeft.days}d</span>
                              <span>:</span>
                              <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
                              <span>:</span>
                              <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
                              <span>:</span>
                              <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
                            </>
                          )}
                        </div>
                      </div>
                      <a
                        href="https://www.tiktok.com/@milumon_gaming"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-black hover:bg-[#FCF9F2] border-2 border-black rounded-lg px-2.5 py-1.5 text-[9px] uppercase font-bold tracking-wider flex items-center gap-1 transition-all shrink-0 select-none decoration-transparent"
                      >
                        🔴 LIVE
                      </a>
                    </div>

                    {/* Central Hatching Chick Graphics */}
                    <div className="w-28 h-28 mx-auto relative mb-1 flex items-center justify-center shrink-0">
                      <span className="text-7xl select-none">🐣</span>
                    </div>

                    {/* High fidelity branded Logo Text */}
                    <div className="mb-1.5 relative">
                      <span className="font-display tracking-widest text-[#FFB000] text-xs block uppercase mb-0.5 font-bold">
                        ★ THE ★
                      </span>
                      <h1 className="font-display text-4xl text-black tracking-normal uppercase leading-none">
                        POLLITOS
                      </h1>
                      <h1 className="font-display text-4xl text-[#FFB000] tracking-normal uppercase leading-none mt-1">
                        AWARDS
                      </h1>
                      <div className={`inline-block font-display text-[11px] px-4 py-1.5 rounded-xl uppercase tracking-widest font-bold mt-2 transform rotate-1 border-3 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] ${phase === 2 ? 'bg-red-600 text-white' : 'bg-[#FFB000] text-black'}`}>
                        {phase === 2 ? '🗳️ FASE 2: GRAN FINAL' : '1ER ANIVERSARIO'}
                      </div>
                    </div>

                    {/* Updated Exact Narrative Hook */}
                    <p className="font-sans text-[13px] text-gray-700 max-w-xs mt-2.5 px-4 leading-normal font-bold">
                      {phase === 2 ? (
                        <>
                          ¡Llegamos a la Gran Final! <br />
                          <span className="text-orange-600">Vota por los 5 más elegidos de cada categoría.</span>
                        </>
                      ) : (
                        <>
                          ¡Es hora de celebrar un año de streams! <br />
                          <span className="text-orange-600">Vota por tus amigos y compañeros de Roblox.</span>
                        </>
                      )}
                    </p>

                    {/* Dual Stats Badges for Mobile */}
                    <div className="flex gap-3 w-full max-w-[290px] mt-3 mb-2">
                      <div className="bg-white p-2.5 rounded-2xl flex-1 text-center border-4 border-black shadow-[2px_2px_0_0_#FFB000]">
                        <p className="text-[10px] uppercase font-bold text-gray-500 font-sans leading-none mb-1">Categorías</p>
                        <p className="text-2xl font-bold font-display text-black leading-none">{categories.length}</p>
                      </div>
                      <div className="bg-white border-4 border-black p-2.5 rounded-2xl flex-1 text-center shadow-[2px_2px_0_0_#0369A1] border-[#0369A1]">
                        <p className="text-[10px] uppercase font-bold text-[#0369A1] font-sans leading-none mb-1">Pollitos</p>
                        <p className="text-2xl font-bold font-display text-[#0369A1] leading-none">{totalNomineesCount}</p>
                      </div>
                    </div>
                  </div>

                  {/* Big Golden Action Button */}
                  <div className="w-full mt-auto pt-3">
                    {timeLeft.isOver ? (
                      <button
                        onClick={() => {
                          soundManager.playPop();
                          setScreen('results');
                        }}
                        className="w-full py-3.5 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display text-lg tracking-wider rounded-2xl border-4 border-black border-b-8 hover:border-b-6 transition-all cursor-pointer font-bold shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-center active:translate-y-1 block focus:outline-none"
                      >
                        🏆 VER SI GANARON TUS FAVORITOS
                      </button>
                    ) : (
                      <button
                        id="start-awards-btn"
                        onClick={handleStartVotingClick}
                        className="w-full py-3.5 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display text-lg tracking-wider rounded-2xl border-4 border-black border-b-8 hover:border-b-6 transition-all cursor-pointer font-bold shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-center active:translate-y-1 block focus:outline-none"
                      >
                        🗳️ COMENZAR VOTACIÓN
                      </button>
                    )}
                    <div className="flex justify-center items-center gap-1.5 text-gray-500 font-sans font-bold text-[10px] mt-2 uppercase tracking-wider">
                      {timeLeft.isOver ? '👉 ¡Entra a ver si les atinaste!' : '🐣 ¡Es rápido y divertido!'}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SCREEN 1.5: AUTH */}
              {screen === 'auth' && (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full py-4 flex flex-col items-center justify-between text-center"
                >
                  <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-[#FCF9F2] border-4 border-black flex items-center justify-center mb-4">
                      <span className="text-5xl">{isWebView ? '⚠️' : '🔐'}</span>
                    </div>

                    <h2 className="font-display text-2xl text-black tracking-normal uppercase mb-1">
                      {isWebView ? 'Acceso Bloqueado' : 'Iniciá con Google'}
                    </h2>
                    
                    {isWebView ? (
                      <div className="mt-2 bg-orange-100 border-4 border-black p-4 rounded-2xl text-left shadow-[4px_4px_0_0_rgba(0,0,0,1)] w-full max-w-xs text-orange-800">
                        <p className="font-sans text-xs font-bold leading-relaxed">
                          Estás usando el navegador de <span className="text-orange-600 font-black">{webViewBrand}</span>. Google bloquea el inicio de sesión acá por seguridad.
                        </p>
                        
                        <div className="mt-3 space-y-2">
                          <button
                            onClick={handleCopyLink}
                            className={`w-full py-2.5 rounded-xl border-2 border-black font-display text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:translate-y-0.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)] cursor-pointer ${
                              copied 
                                ? 'bg-[#DCFCE7] text-[#15803D]' 
                                : 'bg-[#FFB000] hover:bg-[#FFAA00] text-black'
                            }`}
                          >
                            {copied ? '✅ ¡ENLACE COPIADO!' : '📋 COPIAR ENLACE'}
                          </button>

                          <div className="bg-white border-2 border-black p-2.5 rounded-xl text-[11px] font-sans font-bold text-gray-600">
                            <p className="mb-1 text-black font-bold">👉 Para poder votar:</p>
                            <ol className="list-decimal list-inside space-y-1 font-bold">
                              <li>Copia el enlace de arriba.</li>
                              <li>Abre Chrome o Safari en tu celular.</li>
                              <li>Pega el enlace y listo.</li>
                            </ol>
                            {webViewBrand !== 'TikTok' && (
                              <p className="mt-2 text-[10px] text-gray-500 font-bold border-t border-dashed border-gray-300 pt-1.5">
                                Alternativa: Toca los 3 puntitos <span className="text-black font-bold">(⋮ o ...)</span> y elige <span className="text-black font-bold">&quot;Abrir en el navegador&quot;</span>.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="font-sans text-xs font-bold text-gray-600 px-4 max-w-xs">
                        Para votar y guardar tus premios, usá tu cuenta de Google.
                      </p>
                    )}

                    {authError && (
                      <div className="mt-4 bg-red-100 border-2 border-black p-3 rounded-xl text-xs font-bold text-red-600 font-sans w-full max-w-xs">
                        ⚠️ {authError}
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-2">
                    {isWebView ? (
                      <div className="w-full py-3.5 bg-gray-200 text-gray-500 font-display text-base tracking-wider rounded-2xl border-4 border-gray-400 select-none text-center font-bold cursor-not-allowed">
                        ABRIR EN NAVEGADOR EXTERNO
                      </div>
                    ) : (
                      <button
                        onClick={handleGoogleSignIn}
                        className="w-full py-3.5 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display text-base tracking-wider rounded-2xl border-4 border-black border-b-8 hover:border-b-6 cursor-pointer font-bold active:translate-y-1 transition-all shadow-md focus:outline-none"
                      >
                        CONTINUAR CON GOOGLE
                      </button>
                    )}
                    <button
                      onClick={() => setScreen('landing')}
                      className="w-full py-2.5 bg-white text-black hover:bg-[#FCF9F2] font-sans text-xs uppercase tracking-wider rounded-xl border-2 border-black font-bold"
                    >
                      Volver
                    </button>
                  </div>
                </motion.div>
              )}

              {/* SCREEN 2: EGG HATCHING */}
              {screen === 'hatching' && (
                <EggAnimation
                  key="hatching"
                  onComplete={() => {
                    setScreen('welcome');
                  }}
                />
              )}

              {/* SCREEN 3: WELCOME */}
              {screen === 'welcome' && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center py-2 flex flex-col items-center justify-between h-full"
                >
                  <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                      className="w-24 h-24 relative mb-4 flex items-center justify-center shrink-0"
                    >
                      {robloxProfile?.avatarUrl ? (
                        <Image
                          src={robloxProfile.avatarUrl}
                          alt={robloxProfile.displayName}
                          fill
                          sizes="96px"
                          unoptimized
                          className="w-24 h-24 rounded-full border-4 border-black object-cover bg-[#FCF9F2]"
                          style={{ transform: 'scale(1.6) translateY(-8%)', transformOrigin: 'center top', objectPosition: 'center top' }}
                        />
                      ) : (
                        <span className="text-7xl select-none">🐣</span>
                      )}
                    </motion.div>

                    <h2 className="font-display text-2xl text-black uppercase tracking-normal mb-1">
                      ¡Hola, {robloxProfile?.displayName || 'Pollito'}!
                    </h2>
                    <p className="font-sans text-xs font-bold text-gray-600 px-2 tracking-wide mb-5">
                      {robloxProfile?.username ? (
                        <>
                          Tu usuario verificado es <span className="text-orange-600">@{robloxProfile.username}</span>. Hoy ayudarás a votar en la <span className="text-orange-600">{phase === 2 ? 'Gran Final (Fase 2)' : 'Fase Inicial'}</span> de los <span className="text-orange-600">Pollitos Awards 2026</span>.
                        </>
                      ) : (
                        <>Hoy ayudarás a votar en la <span className="text-orange-600">{phase === 2 ? 'Gran Final (Fase 2)' : 'Fase Inicial'}</span> de los <span className="text-orange-600">Pollitos Awards 2026</span>.</>
                      )}
                    </p>

                    <div className="w-full bg-white border-4 border-black p-4 rounded-2xl mb-6 space-y-3.5 text-left shadow-[4px_4px_0_0_#FFB000]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#FFB000] flex items-center justify-center text-black shrink-0 border-2 border-black font-display font-bold">
                          🏆
                        </div>
                        <span className="font-sans text-xs uppercase font-bold text-black">
                          <span className="text-orange-600 text-sm">{categories.length}</span> categorías exclusivas
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#0369A1] flex items-center justify-center text-white shrink-0 border-2 border-black font-display font-bold">
                          👥
                        </div>
                        <span className="font-sans text-xs uppercase font-bold text-black">
                          <span className="text-orange-600 text-sm">{nomineesLoading ? '...' : totalNomineesCount}</span> pollitos nominados
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-black shrink-0 border-2 border-black font-display font-bold">
                          ⏱️
                        </div>
                        <span className="font-sans text-xs uppercase font-bold text-black">
                          VOTACIÓN EN <span className="text-orange-600 text-sm">2</span> MINUTOS
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    id="empezar-votacion-btn"
                    onClick={() => {
                      soundManager.playPop();
                      setSelectedNomineeId(votes[categories[currentIdx]?.id] || null);
                      setScreen('intro');
                    }}
                    className="w-full py-3.5 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display text-base tracking-wider rounded-2xl border-4 border-black border-b-8 hover:border-b-6 cursor-pointer font-bold active:translate-y-1 transition-all shadow-md flex items-center justify-center gap-2 focus:outline-none"
                  >
                    👉 EMPEZAR VOTACIÓN
                  </button>
                </motion.div>
              )}

              {/* SCREEN 4: CATEGORY INTRO */}
              {screen === 'intro' && (
                <motion.div
                  key={`intro-${currentIdx}`}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="py-2 flex flex-col items-center text-center justify-between h-full"
                >
                  <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-[#FCF9F2] rounded-full border-4 border-black flex items-center justify-center mb-4 shadow-md relative">
                      <span className="text-4xl animate-bounce" style={{ animationDuration: '3s' }}>
                        {categories[currentIdx].emoji || '🏆'}
                      </span>
                      <div className="absolute inset-0 border-2 border-dashed border-black/30 rounded-full animate-spin" style={{ animationDuration: '30s' }} />
                    </div>

                    <span className="font-sans text-xs uppercase tracking-widest text-orange-600 font-bold">
                      Categoría {currentIdx + 1} de {categories.length}
                    </span>
                    <h2 className="font-display text-2xl text-black tracking-normal mt-1 max-w-xs leading-none">
                      {categories[currentIdx].title}
                    </h2>

                    <div className="my-5 px-4 py-5 bg-white border-4 border-black rounded-[1.8rem] w-full max-w-xs transform hover:scale-101 transition-all shadow-[4px_4px_0_0_#FFB000]">
                      <span className="text-xl text-orange-500 font-black block leading-none mb-1">“</span>
                      <p className="font-sans text-[15px] md:text-base font-bold text-gray-700 leading-relaxed italic">
                        {categories[currentIdx].description}
                      </p>
                      <span className="text-xl text-orange-500 font-black block leading-none mt-1">”</span>
                    </div>
                  </div>

                  <button
                    id="ver-nominados-btn"
                    onClick={() => {
                      soundManager.playPop();
                      setSelectedNomineeId(votes[categories[currentIdx].id] || null);
                      setScreen('voting');
                    }}
                    className="w-full py-3.5 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display text-base tracking-wider rounded-2xl border-4 border-black border-b-8 hover:border-b-6 cursor-pointer font-bold active:translate-y-1 transition-all shadow-md focus:outline-none"
                  >
                    VER NOMINADOS →
                  </button>
                </motion.div>
              )}

              {/* SCREEN 5: VOTING GRID */}
              {screen === 'voting' && (
                <motion.div
                  key={`voting-${currentIdx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full justify-start gap-2.5 md:gap-3"
                >
                  <div className="w-full mb-1.5 md:mb-2">
                    <div className="flex justify-between items-center text-xs md:text-[10px] text-gray-500 font-sans uppercase tracking-wider mb-0.5 md:mb-1 font-bold">
                      <span>Categoría {currentIdx + 1} de {categories.length}</span>
                      <span className="text-orange-600 font-bold">{Math.round(((currentIdx + 1) / categories.length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 md:h-3 rounded-full overflow-hidden border-2 border-black">
                      <div
                        className="bg-[#FFB000] h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(((currentIdx + 1) / categories.length) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-center mb-1.5 md:mb-2 mt-0.5 md:mt-1">
                    <h3 className="font-display text-lg md:text-xl text-black tracking-normal leading-none uppercase">
                      🏆 {categories[currentIdx].title}
                    </h3>
                    {phase === 2 && (
                      <span className="inline-block bg-red-500 text-white font-bold text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full mt-1.5 border border-black shadow-[1px_1px_0_0_rgba(0,0,0,1)]">
                        Fase 2: Gran Final
                      </span>
                    )}
                    <p className="hidden md:block font-sans text-[11px] text-orange-600 uppercase font-bold tracking-wider mt-1.5">
                      {phase === 2 ? '★ ¡VOTA EN LA GRAN FINAL! ★' : '★ ¡VOTA POR TU FAVORITO! ★'}
                    </p>
                  </div>

                  <div className="hidden md:flex bg-[#FCF9F2] border-2 border-black/80 rounded-xl py-1.5 px-3 items-center justify-center gap-2 mb-2 shadow-sm">
                    <span className="text-xs">💡</span>
                    <span className="font-sans text-[10px] uppercase font-bold text-slate-700">
                      Toca en el pollito que crees que <span className="underline text-orange-600 font-sans">merece ganar</span>
                    </span>
                  </div>

                  <div className="mb-1.5 md:mb-2 rounded-xl border-2 border-black bg-white px-3 py-1.5 md:py-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-[#FFB000] shrink-0" />
                      <input
                        type="text"
                        value={nomineeSearch}
                        onChange={(event) => setNomineeSearch(event.target.value)}
                        placeholder="Buscar nominado..."
                        aria-label="Buscar nominado"
                        className="w-full bg-transparent text-base md:text-sm font-bold text-black placeholder:text-gray-400 outline-none font-sans"
                      />
                      {nomineeSearch && (
                        <button
                          type="button"
                          onClick={() => setNomineeSearch('')}
                          className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full border-2 border-black bg-white text-gray-500 hover:bg-[#FCF9F2] active:scale-95 transition-all"
                          aria-label="Limpiar búsqueda"
                        >
                          <X className="h-3.5 w-3.5 md:h-4 md:w-4 stroke-[3]" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nominees list */}
                  {nomineesLoading ? (
                    <div className="rounded-xl border-2 border-black bg-white px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                      Cargando nominados reales...
                    </div>
                  ) : activeNominees.length === 0 ? (
                    <div className="rounded-xl border-2 border-black bg-white px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                      {nomineeSearch.trim() ? 'No encontramos ese nominado.' : 'No hay nominados visibles todavía.'}
                    </div>
                  ) : (
                    <div className="space-y-1.5 md:space-y-2 mb-2 max-h-[calc(100dvh-270px)] md:max-h-[260px] overflow-y-auto pr-1 scrollbar-thin flex-grow">
                      {activeNominees.map((nominee, idx) => {
                        const isSelected = selectedNomineeId === nominee.id;

                        return (
                          <button
                            key={nominee.id}
                            onClick={() => handleSelectNominee(nominee.id)}
                            className={`w-full text-left p-2.5 md:p-2 rounded-xl flex items-center justify-between border-4 select-none cursor-pointer active:scale-98 transition-all relative focus:outline-none ${isSelected
                              ? 'bg-[#FEF3C7] border-[#FFB000]'
                              : 'bg-white border-gray-100 hover:border-[#FFB000]'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 md:w-10 md:h-10 rounded-full overflow-visible relative flex items-center justify-center bg-[#FCF9F2] border border-black/10 shrink-0">
                                {isSelected && (
                                  <div className="absolute inset-0 bg-[#FFB000]/20 rounded-full animate-ping pointer-events-none" />
                                )}
                                {nominee.profileImageUrl ? (
                                  <Image
                                    src={nominee.profileImageUrl}
                                    alt={nominee.name}
                                    fill
                                    sizes="44px"
                                    unoptimized
                                    className="w-[42px] h-[42px] md:w-[38px] md:h-[38px] rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xl select-none">🐣</span>
                                )}
                              </div>

                              <div>
                                <p className={`font-bold text-base md:text-sm leading-tight tracking-tight text-black ${isSelected ? 'text-[#FFB000] font-sans' : 'text-slate-800 font-sans'}`}>
                                  {nominee.name}
                                </p>
                                <p className="text-[10px] md:text-[8px] font-bold uppercase tracking-wider text-gray-400 font-sans">
                                  NOMINADO {idx + 1}
                                </p>
                              </div>
                            </div>

                            <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#FFB000] text-black' : 'bg-gray-50 text-slate-400'
                              }`}>
                              {isSelected ? (
                                <span className="text-xs font-black">✓</span>
                              ) : (
                                <span className="text-[10px] font-black">{idx + 1}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-auto mb-1.5 md:mb-2 shrink-0">
                    <button
                      onClick={handleConfirmVote}
                      disabled={!selectedNomineeId}
                      className={`w-full py-3 md:py-2.5 px-4 font-display font-bold text-sm md:text-xs uppercase tracking-widest rounded-xl border-3 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-all focus:outline-none flex items-center justify-center gap-2 ${selectedNomineeId
                        ? 'bg-[#FFB000] text-black hover:bg-[#FFAA00] cursor-pointer active:translate-y-[2px]'
                        : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                        }`}
                    >
                      <span>{selectedNomineeId ? 'Confirmar y Siguiente' : 'Selecciona un Favorito'}</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  </div>

                  {categories[currentIdx].funFact && (
                    <div className="bg-[#FEF3C7] border-4 border-black rounded-2xl py-1.5 px-2.5 md:py-2 md:px-3 flex items-center gap-2.5 shrink-0">
                      <span className="text-base md:text-lg">📢</span>
                      <div className="text-left">
                        <p className="font-sans font-bold text-orange-600 uppercase text-[8px] md:text-[9px] tracking-wider">¿SABÍAS QUÉ?</p>
                        <p className="text-slate-800 text-[9px] md:text-[10px] font-bold leading-tight font-sans">
                          {categories[currentIdx].funFact}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* SCREEN 6: INTERMISSION */}
              {screen === 'intermission' && (
                <motion.div
                  key={`intermission-${currentIdx}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="py-4 text-center flex flex-col items-center justify-between h-full min-h-[300px]"
                >
                  <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                      className="w-16 h-16 bg-[#FCF9F2] rounded-full flex items-center justify-center border-4 border-black mb-4"
                    >
                      <p className="text-3xl">
                        {currentIdx === 2 ? '🐣' : currentIdx === 5 ? '💛' : '🎉'}
                      </p>
                    </motion.div>

                    <h4 className="font-display text-xl text-black tracking-normal uppercase">
                      {currentIdx === 2
                        ? '¡SÚPER CHÉVERE!'
                        : currentIdx === 5
                          ? '¡MUCHAS GRACIAS!'
                          : '¡YA CASI ESTAMOS!'}
                    </h4>

                    <div className="bg-white border-4 border-black rounded-2xl p-4 my-4 max-w-xs relative overflow-hidden text-left font-sans shadow-[4px_4px_0_0_#FFB000]">
                      <p className="font-sans text-s text-gray-700 leading-relaxed italic font-bold">
                        {currentIdx === 2
                          ? '¡Llevas 3 categorías! El Team Pollito realizó más de 150 directos llenos de parkour y risas.'
                          : currentIdx === 5
                            ? 'Gracias por formar parte del Team Pollito. ¡Eres el corazón de toda esta linda aventura en Roblox!'
                            : 'Solo queda una categoría... ¡el premio más legendario e importante de todos los Pollitos Awards!'}
                      </p>
                    </div>
                  </div>

                  <button
                    id="next-intermission-btn"
                    onClick={skipIntermission}
                    className="w-full py-3.5 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display text-base tracking-wider rounded-2xl border-4 border-black border-b-8 hover:border-b-6 cursor-pointer text-center font-bold uppercase active:translate-y-1 block focus:outline-none"
                  >
                    CONTINUAR →
                  </button>
                </motion.div>
              )}

              {/* SCREEN 7: SUBMITTING */}
              {screen === 'submitting' && (
                <motion.div
                  key="submitting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-4 flex flex-col items-center justify-between h-full"
                >
                  <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <div className="relative w-36 h-40 flex items-center justify-center select-none mb-6">
                      <div className="absolute inset-0 bg-[#FFB000]/30 rounded-full filter blur-xl opacity-60" />
                      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-md">
                        <rect x="35" y="22" width="30" height="4" rx="2" fill="#fbbf24" opacity="0.3" className="animate-pulse" />
                        <path d="M20,40 L80,40 L80,90 C80,93 77,95 74,95 L26,95 C23,95 20,93 20,90 Z" fill="#ffffff" stroke="#000000" strokeWidth="4" />
                        <rect x="30" y="50" width="40" height="35" rx="5" fill="#facc15" stroke="#000000" strokeWidth="3" />
                        <circle cx="50" cy="65" r="8" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                        <circle cx="50" cy="65" r="4" fill="#000000" />

                        <g>
                          <motion.g
                            initial={{ y: -30, opacity: 1, scale: 0.9 }}
                            animate={{ y: 28, opacity: [1, 1, 0.4, 0], scale: 0.7 }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeIn' }}
                          >
                            <rect x="38" y="0" width="24" height="15" rx="1.5" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                            <line x1="38" y1="0" x2="50" y2="8" stroke="#000000" strokeWidth="2" />
                            <line x1="62" y1="0" x2="50" y2="8" stroke="#000000" strokeWidth="2" />
                          </motion.g>
                        </g>

                        <path d="M15,30 L85,30 C87,30 88,32 88,34 L88,40 L12,40 L12,34 C12,32 13,30 15,30 Z" fill="#e2e8f0" stroke="#000000" strokeWidth="4" />
                        <rect x="34" y="33" width="32" height="3" rx="1.5" fill="#000000" />
                      </svg>
                    </div>

                    <h4 className="font-display text-2xl text-black tracking-normal animate-pulse mb-1 uppercase">
                      📦 GUARDANDO VOTOS
                    </h4>
                    <p className="font-sans text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Cerrando la urna...
                    </p>
                  </div>

                  <div className="w-8 h-8 border-4 border-black border-t-[#FFB000] rounded-full animate-spin mt-2" />
                </motion.div>
              )}

              {/* SCREEN 8: FINAL SUMMARY REWARDS */}
              {screen === 'final' && (
                <motion.div
                  key="final"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-1 flex flex-col items-center justify-between min-h-full w-full pb-4"
                >
                  <div className="text-center mb-3 mt-2">
                    <div className="w-14 h-14 bg-[#FFB000] border-4 border-black rounded-full flex items-center justify-center text-3xl mx-auto shadow-md animate-bounce relative mb-2">
                      🎉
                      <div className="absolute inset-0 border-2 border-dashed border-black rounded-full animate-pulse" />
                    </div>
                    <h2 className="font-display text-2xl text-black tracking-normal uppercase leading-none">
                      🎉 ¡Tu ballot está listo!
                    </h2>
                    <p className="font-sans text-xs font-bold text-gray-500 uppercase tracking-wider mt-1.5 leading-snug">
                      Descargalo y compartilo con la comunidad 🐣
                    </p>
                  </div>

                  <div className="w-full mb-2 shrink-0">
                    <ShareCard votes={votes} robloxProfile={robloxProfile} nominees={nominees} />
                  </div>

                  {!timeLeft.isOver ? (
                    <button
                      id="back-home-btn"
                      onClick={handleRestart}
                      className="w-full py-3.5 bg-white hover:bg-[#FCF9F2] text-black font-display text-sm tracking-wider rounded-xl border-4 border-black select-none cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 uppercase font-bold shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-5 focus:outline-none shrink-0"
                    >
                      🔄 Cambiar Votos / Volver a Votar
                    </button>
                  ) : (
                    <button
                      id="back-results-btn"
                      onClick={() => {
                        soundManager.playPop();
                        setScreen('results');
                      }}
                      className="w-full py-3.5 bg-[#FFB000] hover:bg-[#FFAA00] text-black font-display text-sm tracking-wider rounded-xl border-4 border-black select-none cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 uppercase font-bold shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-5 focus:outline-none shrink-0"
                    >
                      🏆 Ver Resultados Globales
                    </button>
                  )}

                  <div className="w-full space-y-2 text-left mb-3">
                    <p className="font-sans text-[10px] uppercase tracking-widest text-[#ea580c] font-bold mb-1 flex items-center gap-1.5 justify-center">
                      <Award className="w-4 h-4 text-orange-600" /> MÁS CONTENIDO COMUNITARIO
                    </p>

                    <button
                      id="view-milo-message-btn"
                      onClick={() => {
                        soundManager.playPop();
                        setMiloModalOpen(true);
                      }}
                      className="w-full bg-white hover:bg-[#FCF9F2] border-4 border-black py-2 px-3 rounded-xl flex items-center justify-between text-left transition-all active:scale-98 cursor-pointer shadow-[2px_2px_0_0_#FFB000] focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🎥</span>
                        <div>
                          <p className="font-display text-[11px] font-extrabold text-black uppercase tracking-wide leading-none">Mensaje Especial de Milumon</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase font-sans mt-0.5">Unas palabras con mucho amor</p>
                        </div>
                      </div>
                      <span className="text-orange-600 text-lg font-black font-sans">👉</span>
                    </button>

                    <button
                      id="view-date-btn"
                      onClick={() => {
                        soundManager.playPop();
                        setDateModalOpen(true);
                      }}
                      className="w-full bg-white hover:bg-[#FCF9F2] border-4 border-black py-2 px-3 rounded-xl flex items-center justify-between text-left transition-all active:scale-98 cursor-pointer shadow-[2px_2px_0_0_#0369A1] focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📅</span>
                        <div>
                          <p className="font-display text-[11px] font-extrabold text-[#ea580c] uppercase tracking-wide leading-none">La Gala de Premiación</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase font-sans mt-0.5">Cuándo sabremos quién ganó</p>
                        </div>
                      </div>
                      <span className="text-orange-600 text-lg font-black font-sans">👉</span>
                    </button>
                  </div>

                  <div className="h-10 w-full shrink-0" />
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="hidden md:block text-center mt-auto py-2 relative z-20">
        <p className="font-sans text-[10px] text-gray-700 tracking-wide font-bold uppercase">
          🏆 Comunidad del Team Pollito • Milumon 2026 • Creado con ❤️ para todo el Team Pollito
        </p>
      </footer>

      {/* POPUP MODAL A: MENSAJE DE MILUMON */}
      <AnimatePresence>
        {miloModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border-4 border-black rounded-[2rem] p-6 w-full max-w-sm relative brutalist-shadow text-center text-black"
            >
              <button
                onClick={() => {
                  soundManager.playPop();
                  setMiloModalOpen(false);
                }}
                className="absolute top-4 right-4 text-black hover:scale-105 active:scale-95 transition-all w-8 h-8 flex items-center justify-center border-2 border-black rounded-lg bg-white cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>

              <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3 text-3xl border-2 border-black">
                💝
              </div>

              <h4 className="font-display text-xl text-black tracking-normal uppercase mb-2">
                ¡Gracias de corazón!
              </h4>

              <div className="bg-orange-50 p-4 rounded-2xl text-left border-4 border-black text-xs leading-relaxed max-h-[180px] overflow-y-auto font-comic text-black font-bold">
                <p className="mb-2">“¡Hola, mi pollit@ hermos@! 🐣💛”</p>

                <p className="mb-2">
                  No puedo creer que ya haya pasado{" "}
                  <span className="text-orange-600 font-extrabold">1 añito</span>{" "}
                  desde que empezó esta hermosa aventura del Team Pollito. Parece que fue ayer cuando todo comenzó donde la meta apenas era 200 seguidores y ahora ya tenemos un montón de recuerdos, risas y momentos inolvidables juntos. ✨
                </p>

                <p className="mb-2">
                  Gracias por acompañarme en cada stream, por estar siempre ahí, por apoyar cada locura que hacemos y por formar parte de esta comunidad tan especial. 🥹💛
                </p>

                <p className="mb-2">
                  Cada mensaje, cada conversación y cada momento compartido significa muchísimo para mí. Ustedes son el corazón del{" "}
                  <span className="text-orange-600 font-extrabold">Team Pollito</span>{" "}
                  y hacen que todo esto valga la pena. 🐣
                </p>

                <p>
                  Gracias por este primer añito juntos. Espero que sigamos compartiendo muchas aventuras, muchas risas y muchísimos momentos más. !PORQUE A PARTIR DE HOY...! TU Y YO... POLLITOS POR SIEMPRE 🐣💛✨
                </p>
              </div>

              <p className="font-display text-base text-orange-600 mt-3 font-black">
                🐣 Milumon • Streamer Oficial
              </p>


              <button
                onClick={() => {
                  soundManager.playPop();
                  setMiloModalOpen(false);
                }}
                className="mt-4 w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-display font-black text-sm tracking-wider rounded-xl border-2 border-black border-b-4 hover:border-b-2 active:translate-y-1 transition-all uppercase cursor-pointer focus:outline-none"
              >
                ¡TE QUIERO MILUMON! 💛
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL B: FECHA DE PREMIACIÓN */}
      <AnimatePresence>
        {dateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border-4 border-black rounded-[2rem] p-6 w-full max-w-sm relative brutalist-shadow text-center text-black"
            >
              <button
                onClick={() => {
                  soundManager.playPop();
                  setDateModalOpen(false);
                }}
                className="absolute top-4 right-4 text-black hover:scale-105 active:scale-95 transition-all w-8 h-8 flex items-center justify-center border-2 border-black rounded-lg bg-white cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>

              <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3 text-3xl border-2 border-black">
                📅
              </div>

              <h4 className="font-display text-xl text-black tracking-normal uppercase mb-0.5">
                La Gran Gala
              </h4>
              <p className="font-comic text-[10px] text-orange-600 uppercase tracking-widest font-black mb-3">
                Pollitos Awards 2026
              </p>

              <div className="bg-orange-50 p-3.5 rounded-2xl border-4 border-black space-y-3 text-left font-sans text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl">📅</span>
                  <div>
                    <p className="font-comic text-[9px] text-[#ea580c] font-black uppercase">Día Legendario</p>
                    <p className="font-bold text-black">Martes, 16 de Junio de 2026</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-xl">🕕</span>
                  <div>
                    <p className="font-comic text-[9px] text-[#ea580c] font-black uppercase">Hora de Conexión</p>
                    <p className="font-bold text-black">19:30 Hs (GMT-5 / Horario Estelar)</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-xl">🎥</span>
                  <div>
                    <p className="font-comic text-[9px] text-[#ea580c] font-black uppercase">Canal del Evento</p>
                    <p className="font-bold text-[#ea580c]">¡En vivo por TikTok @milumon_gaming!</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-100 border-2 border-dashed border-yellow-400 p-2.5 rounded-xl font-comic text-[10px] text-slate-700 mt-3.5 leading-snug font-bold">
                🔔 ¡No faltes en Roblox con tu mejor hoodie amarillo para subir al escenario virtual con Milumon!
              </div>

              <button
                onClick={() => {
                  soundManager.playPop();
                  setDateModalOpen(false);
                }}
                className="mt-4 w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-display font-black text-sm tracking-wider rounded-xl border-2 border-black border-b-4 hover:border-b-2 active:translate-y-1 transition-all uppercase cursor-pointer focus:outline-none"
              >
                🏆 ¡AGENDADO! LISTO CON MI HOODIE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ROBLOX ONBOARDING MODAL */}
      <RobloxOnboarding
        isOpen={robloxOnboardingOpen}
        onClose={() => setRobloxOnboardingOpen(false)}
        onConfirm={async () => {
          if (session) {
            await checkRobloxProfile(session);
            fetchUserVotes(session.user.id);
          }
        }}
        userSession={{ session }}
        currentProfile={robloxProfile}
      />

    </div>
  );
}
