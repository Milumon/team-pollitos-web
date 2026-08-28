'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  Clock,
  AlertTriangle,
  Check,
  Lock,
  ShieldAlert,
  Loader,
  Users,
  CalendarDays,
  Crown,
  Headphones,
  Link2,
  LogIn,
} from 'lucide-react';
import { TikTokRankingLanding } from '@/components/tiktok-rankings/RankingViews';
import { LiveBanner } from '@/components/landing/LiveBanner';

import { PwaInstallWidget, requestPwaInstall } from '@/components/PwaInstallWidget';

import { supabase } from '@/lib/supabaseClient';
import { buildAccessPath } from '@/lib/authRouting';
import { Session } from '@supabase/supabase-js';
import { Header } from '@/components/ui/Header';
import { NavBar } from '@/components/ui/NavBar';
import { Button } from '@/components/ui/Button';
import {
  MEMBER_DISPLAY_NAME_INPUT_PATTERN,
  MEMBER_DISPLAY_NAME_MAX_LENGTH,
  MEMBER_DISPLAY_NAME_MIN_LENGTH,
} from '@/lib/memberDisplayName';

type Member = {
  roblox_user: string;
  roblox_display_name: string;
  roblox_avatar_url: string | null;
  role?: string;
  is_admin?: boolean;
  minecraft_rank?: string;
};

type Slot = {
  id: string;
  slot_date: string;
  slot_time: string;
};

type InterviewStatus = {
  status: 'none' | 'pending' | 'official' | 'approved' | 'rejected';
  interview_date?: string;
  interview_time?: string;
  roblox_user?: string;
  roblox_display_name?: string | null;
  tiktok_user?: string;
  declared_minecraft_username?: string | null;
  identity_confirmed_at?: string | null;
  ban_reason?: string;
  return_reason?: string;
  rejection_reason?: string;
  avatar_url?: string | null;
  testimonial?: string | null;
  testimonial_approved?: boolean;
  is_admin?: boolean;
  already_interviewed?: boolean;
  needs_application?: boolean;
  legacy_minecraft_username?: string | null;
  legacy_minecraft_edition?: 'java' | 'bedrock' | null;
};

type VerifiedRobloxProfile = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  username: string;
};

type Testimonial = {
  roblox_display_name: string;
  roblox_user: string;
  roblox_avatar_url: string | null;
  testimonial: string;
};

const ROBLOX_COMMUNITY_URL = 'https://www.roblox.com/es/communities/994126945/MILUMON-TEAM-POLLITO#!/about';
const ROBLOX_SHIRT_URL = 'https://www.roblox.com/es/catalog/75919610314518/Camiseta-Team-Pollito';

function getMemberDisplayName(status: InterviewStatus) {
  const displayName = status.roblox_display_name?.trim().replace(/^🐣\s*|\s*🐣$/g, '').trim();
  return displayName || status.roblox_user || 'POLLITO';
}

// Roles estáticos mapeados por Roblox username
const getMemberRole = (username: string, member?: Member) => {
  if (username.toLowerCase().includes('milumon') || member?.minecraft_rank === 'pollito_admin') {
    return 'Admin 👑';
  }
  if (member?.minecraft_rank === 'pollito_moderador') {
    return 'Moderador 🛡️';
  }
  if (member?.minecraft_rank === 'pollito_invitado') {
    return 'Pollito Invitado 🐣';
  }
  return 'Pollito Oficial 👑';
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'Admin 👑': return 'bg-red-50 text-red-700 border border-red-200 font-bold';
    case 'Moderador 🛡️': return 'bg-purple-50 text-purple-700 border border-purple-200 font-bold';
    case 'Pollito Oficial 👑': return 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold';
    case 'Pollito Invitado 🐣': return 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold';
    default: return 'bg-gray-50 text-gray-600 border border-gray-200';
  }
};

function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const doubled = [...testimonials, ...testimonials];

  return (
    <div className="relative -mx-1 overflow-hidden px-1">
      <div
        className="testimonial-track flex w-max gap-5 pb-2"
        aria-label="Opiniones de la comunidad"
      >
        {doubled.map((t, idx) => (
          <div
            key={`${t.roblox_user}-${idx}`}
            className="testimonial-card relative shrink-0 overflow-hidden rounded-[22px] bg-[#f5e9bc] shadow-[0_10px_26px_rgba(76,59,18,.12)]"
          >
            {t.roblox_avatar_url ? (
              <Image src={t.roblox_avatar_url} alt="" aria-hidden="true" fill sizes="320px" unoptimized className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scale(1.35) translateY(-3%)', transformOrigin: 'center top' }} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[#fff8dc] text-7xl">🐣</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/20" />
            <div className="absolute inset-x-3 bottom-3 z-10 rounded-[16px] bg-white/75 p-4 shadow-[0_4px_14px_rgba(0,0,0,.08)] backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="text-sm tracking-[-0.1em] text-amber-500" aria-label="5 estrellas">★★★★★</span>
              </div>
              <p className="mt-2 min-h-[48px] text-sm font-semibold leading-snug text-[#2D3139]">&quot;{t.testimonial}&quot;</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate font-display text-base font-bold leading-none text-[#2D3139]">{t.roblox_display_name}</h4>
                  <span className="mt-1 block truncate text-[10px] text-gray-500">@{t.roblox_user}</span>
                </div>
                {idx % 2 === 0 && <span className="text-base opacity-60" aria-hidden="true">🐣</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComunidadPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersTab, setMembersTab] = useState<'oficiales' | 'invitados' | 'todos'>('oficiales');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [statusInfo, setStatusInfo] = useState<InterviewStatus>({ status: 'none' });

  // Testimonials States
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loadingTestimonials, setLoadingTestimonials] = useState(true);
  const [userTestimonial, setUserTestimonial] = useState('');
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialSuccess, setTestimonialSuccess] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);

  // Modal Rules State
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Initial identity confirmation
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [identityDisplayName, setIdentityDisplayName] = useState('');
  const [identityTiktokUser, setIdentityTiktokUser] = useState('');
  const [identityMinecraftUsername, setIdentityMinecraftUsername] = useState('');
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // Loading states
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Calendar State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Form states
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [robloxUser, setRobloxUser] = useState('');
  const [tiktokUser, setTiktokUser] = useState('');
  const [banReason, setBanReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [alreadyInterviewed, setAlreadyInterviewed] = useState(false);
  const [memberType, setMemberType] = useState<"pollito_invitado" | "pollito_oficial">("pollito_invitado");
  const [verifiedRobloxProfile, setVerifiedRobloxProfile] = useState<VerifiedRobloxProfile | null>(null);
  const [robloxProfileConfirmed, setRobloxProfileConfirmed] = useState(false);
  const [verifyingRoblox, setVerifyingRoblox] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isDuplicate, setIsDuplicate] = useState(false);
  const [conflictedEmail, setConflictedEmail] = useState('');
  const [forceClaim, setForceClaim] = useState(false);
  const [claimReason, setClaimReason] = useState('');
  const [comingSoon, setComingSoon] = useState(false);

  const isAdmin = statusInfo?.is_admin || false;

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/interviews/slots');
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  };

  const fetchUserStatus = async (token: string) => {
    try {
      const res = await fetch('/api/interviews/my-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('DEBUG: /api/interviews/my-status devolvió:', data);
        setStatusInfo(data);
        if (data.status === 'approved') {
          const suggestedName = data.roblox_user || 'Pollito';
          const savedName = data.roblox_display_name?.replace(/^🐣\s*|\s*🐣$/g, '').trim();
          setIdentityDisplayName(data.identity_confirmed_at ? (savedName || suggestedName) : suggestedName);
          setIdentityTiktokUser(data.tiktok_user || '');
          setIdentityMinecraftUsername(data.declared_minecraft_username || '');
          setIdentityModalOpen(!data.identity_confirmed_at);
        }
        if (data.testimonial) {
          setUserTestimonial(data.testimonial);
        }
        if (data.roblox_user) {
          setRobloxUser(data.roblox_user);
          setVerifiedRobloxProfile({
            id: data.roblox_user_id || 0,
            displayName: data.roblox_user,
            avatarUrl: data.avatar_url || null,
            username: data.roblox_user,
          });
          setRobloxProfileConfirmed(true);
        }
        if (data.tiktok_user) {
          setTiktokUser(data.tiktok_user);
        }
      } else {
        const errText = await res.text();
        console.error('DEBUG ERROR: /api/interviews/my-status falló con status:', res.status, errText);
      }
    } catch (err) {
      console.error('DEBUG ERROR: Excepción en fetchUserStatus:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleIdentitySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setIdentitySaving(true);
    setIdentityError(null);

    try {
      const response = await fetch('/api/profile/identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          displayName: identityDisplayName,
          tiktokUser: identityTiktokUser,
          minecraftUsername: identityMinecraftUsername,
        }),
      });
      const data = await response.json() as { error?: string; identityConfirmed?: boolean; detailsSaved?: boolean; profile?: InterviewStatus };
      if (!response.ok) {
        if (data.detailsSaved) {
          setStatusInfo((current) => ({
            ...current,
            tiktok_user: identityTiktokUser.replace(/^@/, '').trim().toLowerCase(),
            declared_minecraft_username: identityMinecraftUsername.trim() || null,
          }));
        }
        throw new Error(data.error || 'No se pudo confirmar tu identidad.');
      }

      setStatusInfo((current) => ({
        ...current,
        roblox_display_name: data.profile?.roblox_display_name || `🐣 ${identityDisplayName.trim()} 🐣`,
        tiktok_user: data.profile?.tiktok_user || identityTiktokUser.trim().toLowerCase(),
        declared_minecraft_username: data.profile?.declared_minecraft_username || identityMinecraftUsername.trim() || null,
        identity_confirmed_at: data.profile?.identity_confirmed_at || new Date().toISOString(),
      }));
      setIdentityModalOpen(false);
    } catch (error: unknown) {
      setIdentityError(error instanceof Error ? error.message : 'No se pudo confirmar tu identidad.');
    } finally {
      setIdentitySaving(false);
    }
  };

  const fetchTestimonials = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('/api/testimonials', { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setTestimonials(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching testimonials:', err);
    } finally {
      window.clearTimeout(timeout);
      setLoadingTestimonials(false);
    }
  };

  const handleSendTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestimonialError(null);
    setTestimonialSuccess(false);

    if (!userTestimonial.trim()) {
      setTestimonialError('La opinión no puede estar vacía.');
      return;
    }

    try {
      setTestimonialSubmitting(true);
      const token = session?.access_token;
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ testimonial: userTestimonial.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        setTestimonialError(data.error || 'Error al enviar la opinión.');
        return;
      }

      setTestimonialSuccess(true);
      setStatusInfo(prev => ({
        ...prev,
        testimonial: userTestimonial.trim(),
        testimonial_approved: false
      }));
      fetchTestimonials();

      // Cerrar modal automáticamente después de mostrar éxito
      setTimeout(() => {
        setShowTestimonialModal(false);
        setTestimonialSuccess(false);
      }, 2000);
    } catch {
      setTestimonialError('Error de red al enviar la opinión.');
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  const handleLogin = async () => {
    window.location.assign(buildAccessPath(`${window.location.pathname}${window.location.search}`));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const resetRobloxVerification = () => {
    setVerifiedRobloxProfile(null);
    setRobloxProfileConfirmed(false);
    setIsDuplicate(false);
    setConflictedEmail('');
    setForceClaim(false);
    setClaimReason('');
  };

  const handleVerifyRobloxForInterview = async () => {
    setFormError(null);
    setIsDuplicate(false);
    setConflictedEmail('');

    if (!robloxUser.trim()) {
      setFormError('El nombre de usuario de Roblox es obligatorio.');
      return false;
    }

    try {
      setVerifyingRoblox(true);
      const token = session?.access_token;
      const res = await fetch('/api/profile/verify-roblox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ robloxUsername: robloxUser.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isDuplicate) {
          setIsDuplicate(true);
          setConflictedEmail(data.conflictedEmail || '');
        }
        setVerifiedRobloxProfile(null);
        setRobloxProfileConfirmed(false);
        setFormError(data.error || 'No se pudo validar ese usuario de Roblox.');
        return false;
      }

      setVerifiedRobloxProfile({
        id: data.id,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl || null,
        username: robloxUser.trim(),
      });
      setRobloxProfileConfirmed(false);
      return true;
    } catch {
      setFormError('Ocurrió un error al consultar Roblox. Intenta nuevamente.');
      return false;
    } finally {
      setVerifyingRoblox(false);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // No slot required in new membership flow
    if (!robloxUser.trim()) {
      setFormError('El nombre de usuario de Roblox es obligatorio.');
      return;
    }
    if (!tiktokUser.trim()) {
      setFormError('El nombre de usuario de TikTok es obligatorio.');
      return;
    }
    if (isReturning && (!banReason.trim() || !returnReason.trim())) {
      setFormError('Por favor completa todos los campos explicando tu situación.');
      return;
    }
    if (!robloxProfileConfirmed) {
      await handleVerifyRobloxForInterview();
      return;
    }

    try {
      setSubmitting(true);
      const token = session?.access_token;
      const res = await fetch('/api/interviews/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          memberType,
          robloxUsername: robloxUser.trim(),
          tiktokUsername: tiktokUser.trim(),
          isReturning,
          banReason: isReturning ? banReason.trim() : null,
          returnReason: isReturning ? returnReason.trim() : null,
          testimonial: userTestimonial.trim() || null,
          alreadyInterviewed: memberType === 'pollito_oficial',
          forceClaim,
          claimReason: forceClaim ? claimReason.trim() : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Error al agendar la entrevista.');
        return;
      }

      setFormSuccess(true);
      setIsRescheduling(false);
      setAlreadyInterviewed(false);
      resetRobloxVerification();
      fetchSlots();
      if (token) {
        fetchUserStatus(token);
      }
    } catch {
      setFormError('Ocurrió un error de red. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.scrollMarginTop = '88px';
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleJoinClick = () => {
    if (!session) {
      handleLogin();
    } else {
      scrollToSection('admision');
    }
  };

  // Fetch initial data & auth state
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchMembers();
      fetchSlots();
      fetchTestimonials();
    });

    supabase.auth.getSession().then((res) => {
      const currentSession = res.data?.session || null;
      Promise.resolve().then(() => {
        setSession(currentSession);
        if (currentSession) {
          setLoadingStatus(true);
          fetchUserStatus(currentSession.access_token);
        }
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, currentSession: Session | null) => {
      Promise.resolve().then(() => {
        setSession(currentSession);
        if (currentSession) {
          setLoadingStatus(true);
          fetchUserStatus(currentSession.access_token);
        } else {
          setStatusInfo({ status: 'none' });
        }
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const showBookingForm = statusInfo.status === 'none' || statusInfo.status === 'rejected' || isRescheduling;

  const sortedMembers = [...members].sort((a, b) => {
    const aIsStr = a.roblox_user.toLowerCase().includes('milumon');
    const bIsStr = b.roblox_user.toLowerCase().includes('milumon');
    if (aIsStr && !bIsStr) return -1;
    if (!aIsStr && bIsStr) return 1;
    return 0;
  });

  // Calendar Helpers (Mes Corriente)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthName = now.toLocaleString('es-ES', { month: 'long' }).toUpperCase();

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const totalDays = lastDay.getDate();

  // Ajustar semana LUN=0, DOM=6
  const startDayOfWeek = firstDay.getDay(); 
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const calendarCells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(new Date(currentYear, currentMonth, d));
  }
  // Filtrar slots de la fecha seleccionada
  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : '';
  const activeDateSlots = slots.filter(s => s.slot_date === selectedDateStr);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D3139] selection:bg-[#FFB000] selection:text-black font-sans flex flex-col justify-between">
      <PwaInstallWidget />
      <div id="inicio">
        {/* HEADER NAVBAR */}
        <Header
          session={session}
          isAdmin={isAdmin}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          scrollToSection={scrollToSection}
        />
        <LiveBanner />

        {/* Mobile Menu Panel */}
        <NavBar
          variant="drawer"
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          scrollToSection={scrollToSection}
          session={session}
          statusInfo={{ is_admin: isAdmin }}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />


        {/* CONTENEDOR PRINCIPAL */}
        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-16 px-4 sm:mt-12 sm:gap-20">
          {/* HERO SECTION */}
          <section className="relative isolate min-h-[650px] overflow-hidden rounded-[2rem] bg-[#101216] text-white shadow-[0_20px_60px_rgba(27,29,34,.18)] sm:min-h-[620px]">
            <div className="absolute inset-0 -z-20 bg-[#101216]" />
            <Image src="/images/fondo.png" alt="" aria-hidden="true" fill sizes="100vw" className="absolute inset-0 -z-10 hidden h-full w-full object-cover object-center md:block" />
            <Image src="/images/fondomobileadaptado.png" alt="" aria-hidden="true" fill sizes="100vw" className="absolute inset-0 -z-10 h-full w-full object-cover object-top md:hidden" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0c0e12]/95 via-[#0c0e12]/70 to-transparent md:from-[#0c0e12]/90 md:via-[#0c0e12]/45" />
            <div className="flex min-h-[650px] items-start px-6 pb-12 pt-28 sm:min-h-[620px] sm:px-10 sm:pb-14 sm:pt-32 md:items-center md:pt-8">
              <div className="max-w-xl space-y-6">
              {session && statusInfo.status === 'approved' ? (
                <>
                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <h2 className="min-w-0 max-w-full break-words font-display text-3xl font-bold leading-[.95] tracking-tight text-left sm:text-5xl md:text-6xl">
                      ¡Bienvenido <br className="sm:hidden" />al Team Pollito, <br />
                      <span className="mt-2 block break-words font-display text-3xl font-bold tracking-tighter text-[#FFD500] text-shadow-hard-lg sm:text-5xl md:text-6xl">
                        {getMemberDisplayName(statusInfo)}!
                      </span>
                    </h2>
                    <span className="shrink-0 text-4xl drop-shadow-[3px_3px_0_rgba(0,0,0,0.3)] sm:text-5xl md:text-6xl">🐣</span>
                  </div>
                  <p className="max-w-[28rem] break-words font-sans text-sm font-semibold leading-relaxed text-white/80 sm:text-base">
                    Tu cuenta está lista. Participa en los directos, juega con la comunidad y usa las herramientas del LIVE.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                    <Link href="/panel/sonidos" className="w-full decoration-transparent sm:w-auto">
                      <Button variant="primary" size="lg" className="w-full sm:w-auto">
                        ✓ Interactuar con el directo
                      </Button>
                    </Link>
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={requestPwaInstall}>
                      📲 Añadir a pantalla de inicio
                    </Button>
                  </div>
                </>
              ) : session && statusInfo.needs_application ? (
                <>
                  <div className="flex items-start gap-4">
                    <h2 className="font-display text-4xl font-bold leading-none tracking-tight text-left sm:text-5xl md:text-6xl">
                      Completa tu <br />
                      <span className="mt-1 block font-display text-4xl font-bold tracking-tighter text-[#FFD500] text-shadow-hard-lg sm:text-5xl md:text-6xl">
                        registro
                      </span>
                    </h2>
                    <span className="shrink-0 text-5xl drop-shadow-[3px_3px_0_rgba(0,0,0,0.3)] md:text-6xl">📝</span>
                  </div>
                  <p className="max-w-xl font-sans text-sm font-semibold leading-relaxed text-white/80 sm:text-base">
                    Detectamos una vinculación de Minecraft, pero todavía no tienes una postulación web. Completa tus datos para que un Administrador pueda revisar tu ingreso.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="primary" size="lg" onClick={() => scrollToSection('admision')}>
                      Completar mi registro
                    </Button>
                  </div>
                </>
              ) : session && statusInfo.status === 'pending' ? (
                <>
                  <div className="flex items-start gap-4">
                    <h2 className="font-display text-4xl font-bold leading-none tracking-tight text-left sm:text-5xl md:text-6xl">
                      ¡Hola, <br />
                      <span className="mt-1 block font-display text-4xl font-bold tracking-tighter text-[#FFD500] text-shadow-hard-lg sm:text-5xl md:text-6xl">
                        @{statusInfo.roblox_user || 'POLLITO'}!
                      </span>
                    </h2>
                    <span className="shrink-0 text-5xl drop-shadow-[3px_3px_0_rgba(0,0,0,0.3)] md:text-6xl">📅</span>
                  </div>
                  <p className="max-w-xl font-sans text-sm font-semibold leading-relaxed text-white/80 sm:text-base">
                    Tu entrevista de admisión ya está programada. Consulta los detalles de la fecha y el horario del stream de Milumon para participar en vivo.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="primary" size="lg" onClick={() => scrollToSection('admision')}>
                      Ver mi entrevista
                    </Button>
                    <Button variant="secondary" size="lg" onClick={() => scrollToSection('reglas-testimonios')}>
                      Reglas
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-4">
                    <h2 className="font-display text-4xl font-bold leading-none tracking-tight text-left sm:text-5xl md:text-6xl">
                      Bienvenidos a <br />
                      <span className="mt-1 block font-display text-5xl font-bold tracking-tighter text-[#FFD500] text-shadow-hard-lg sm:text-6xl md:text-7xl">
                        Team Pollito
                      </span>
                    </h2>
                    <span className="shrink-0 text-5xl drop-shadow-[3px_3px_0_rgba(0,0,0,0.3)] md:text-6xl">🐣</span>
                  </div>
                  <p className="max-w-xl font-sans text-sm font-semibold leading-relaxed text-white/80 sm:text-base">
                    Juega, participa en los directos y comparte momentos con la comunidad en Roblox y Minecraft.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="primary" size="lg" onClick={handleJoinClick}>
                      <Users className="w-4 h-4" />
                      Únete a la Comunidad
                    </Button>
                    <Button variant="secondary" size="lg" onClick={requestPwaInstall}>
                      📲 Añadir a pantalla de inicio
                    </Button>
                  </div>
                </>
              )}
              </div>
            </div>
          </section>

          {/* PODIO DE POLLITOS DESTACADOS */}
          <div className="order-2"></div>

          {/* JUEGA CON NOSOTROS */}
          <section className="order-3 space-y-6">
            <div className="text-center">
              <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-[#D4A000]">Dos formas de jugar</p>
              <h3 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#2D3139] sm:text-4xl">Juega con nosotros</h3>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <article className="flex h-full flex-col overflow-hidden rounded-3xl border-2 border-[#FFD500] bg-white shadow-[8px_8px_0_#FFD500]">
                <div className="flex min-h-48 items-center justify-center bg-[#FFF7DC] p-6 sm:min-h-56">
                  <Image src="/images/polooficial.webp" alt="Polo oficial del Team Pollito en Roblox" width={208} height={208} className="h-44 w-44 object-contain drop-shadow-[0_12px_18px_rgba(76,59,18,.16)] sm:h-52 sm:w-52" />
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#D4A000]">Roblox</p>
                  <h4 className="mt-2 font-display text-2xl font-bold text-[#2D3139]">La comunidad oficial</h4>
                  <p className="mt-3 flex-1 text-sm font-medium leading-relaxed text-[#64748B]">Únete al grupo oficial de Team Pollito y lleva el polo oficial en tus partidas.</p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a href={ROBLOX_COMMUNITY_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl bg-[#FFD500] px-4 py-3 text-sm font-black text-black transition hover:brightness-105">Unirte a la comunidad</a>
                    <a href={ROBLOX_SHIRT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border-2 border-[#E8DFC5] px-4 py-3 text-sm font-black text-[#64748B] transition hover:border-[#FFD500]">Ver polo oficial</a>
                  </div>
                </div>
              </article>
              <article className="flex h-full flex-col overflow-hidden rounded-3xl border-2 border-[#FFD500] bg-[#1B1D22] text-white shadow-[8px_8px_0_#FFD500]">
                <div className="flex min-h-48 items-center justify-center bg-[radial-gradient(circle_at_center,_#35373d,_#1B1D22)] p-6 sm:min-h-56"><span className="text-8xl drop-shadow-[4px_4px_0_rgba(0,0,0,.3)]" aria-hidden="true">⛏️</span></div>
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#FFD500]">Minecraft</p>
                  <h4 className="mt-2 font-display text-2xl font-bold">Construye con los pollitos</h4>
                  <p className="mt-3 flex-1 text-sm font-medium leading-relaxed text-gray-300">Explora y construye en un mundo compartido para 20 jugadores. Necesitas una cuenta de la comunidad y la aprobación de un Administrador.</p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link href="/minecraft" className="inline-flex items-center justify-center rounded-xl bg-[#FFD500] px-4 py-3 text-sm font-black text-black transition hover:brightness-105">Ver servidor</Link>
                    <Link href="/minecraft/guias#como-entrar" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">Cómo entrar</Link>
                  </div>
                </div>
              </article>
            </div>
          </section>

          {/* TESTIMONIOS: inmediatamente debajo del hero */}
          <section id="testimonios" className="order-2 scroll-mt-24 space-y-6 py-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">⭐</span>
                  <h3 className="font-display font-bold text-2xl tracking-tight text-[#2D3139]">Lo que dicen los pollitos</h3>
                </div>
                <p className="mt-1 pl-7 text-xs font-medium text-gray-500">Lo que nuestra comunidad dice del Team Pollito 🐣</p>
              </div>
              {session && statusInfo.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => {
                    setUserTestimonial(statusInfo.testimonial || '');
                    setShowTestimonialModal(true);
                    setTestimonialError(null);
                    setTestimonialSuccess(false);
                  }}
                  className="w-full shrink-0 rounded-xl bg-[#FFC200] px-5 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-105 active:scale-[0.97] sm:w-auto"
                >
                  <span>💬</span>{' '}
                  {statusInfo.testimonial ? 'Editar mi opinión' : 'Dejar mi opinión'}
                </button>
              )}
            </div>

            {loadingTestimonials ? (
              <div className="flex justify-center items-center py-12">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
                  <Loader className="w-8 h-8 text-[#FFC200]" />
                </motion.div>
              </div>
            ) : testimonials.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <p className="font-sans text-sm text-gray-400">No hay opiniones aprobadas aún.</p>
              </div>
            ) : (
              <TestimonialCarousel testimonials={testimonials} />
            )}

          </section>

          <div className="order-4">
            <TikTokRankingLanding accessToken={session?.access_token} />
          </div>

          {/* BENEFICIOS SECTION */}
          <section id="beneficios" className="order-6 scroll-mt-24 space-y-6 pt-8">
            <div className="text-center">
              <h3 className="font-display font-bold text-3xl tracking-tight leading-none text-[#2D3139]">
                ¿Qué puedes hacer en Team Pollito? 🐣
              </h3>
              <p className="font-sans text-xs text-gray-500 font-bold mt-2">
                Juega, participa y comparte con la comunidad.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { emoji: '🎮', title: 'Participa en el LIVE', desc: 'Envía sonidos, efectos y mensajes que aparecen en directo.' },
                { emoji: '🏆', title: 'Mira los rankings', desc: 'Descubre quiénes destacaron en la comunidad.' },
                { emoji: '🎲', title: 'Juega Roblox', desc: 'Únete al grupo y juega con otros pollitos.' },
                { emoji: '⛏️', title: 'Juega Minecraft', desc: 'Construye y explora en un mundo compartido.' },
                { emoji: '⭐', title: 'Personaliza tu perfil', desc: 'Conecta tus cuentas y muestra tu identidad.' },
                { emoji: '🤝', title: 'Conoce otros pollitos', desc: 'Participa y juega siempre con respeto.' }
              ].map((b, i) => (
                <div key={i} className="bg-white border border-gray-200/80 p-7 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,.1)] hover:translate-y-[-2px] transition-all duration-200 flex flex-col items-start gap-4">
                  <span className="text-4xl">{b.emoji}</span>
                  <div className="text-left">
                    <h4 className="font-display font-bold text-base tracking-tight text-[#2D3139] leading-tight">
                      {b.title}
                    </h4>
                    <p className="font-sans text-sm text-gray-500 leading-relaxed mt-2">
                      {b.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TIMELINE DE INGRESO */}
          <section id="timeline-ingreso" className="order-8 scroll-mt-24 space-y-8 pt-8">
            <div className="text-center">
              <h3 className="font-display font-bold text-3xl tracking-tight leading-none text-[#2D3139]">
                ¿Quieres ser Miembro Oficial? 🐣
              </h3>
              <p className="font-sans text-sm text-gray-500 mt-2">
                Completa estos pasos para unirte oficialmente al equipo.
              </p>
            </div>
            <div className="relative">
              <div className="absolute left-8 top-8 bottom-8 border-l border-dashed border-[#E5D9B4] md:hidden" />
              <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px border-t border-dashed border-[#E5D9B4] z-0" />
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
                {[
                  { id: '1', title: 'Crea tu cuenta', desc: 'Inicia sesión de forma rápida y segura con Google.', icon: LogIn },
                  { id: '2', title: 'Elige un horario', desc: 'Selecciona una fecha y hora disponible para tu entrevista.', icon: CalendarDays },
                  { id: '3', title: 'Conecta Roblox y TikTok', desc: 'Comparte tus cuentas para que podamos comprobarlas.', icon: Link2 },
                  { id: '4', title: 'Preséntate en el LIVE', desc: 'Habla con Milumon en el directo del horario que elegiste.', icon: Headphones },
                  { id: '5', title: 'Espera la aprobación', desc: 'Si eres aprobado, aparecerás como Miembro Oficial.', icon: Crown }
                ].map((step, idx) => (
                  <div key={idx} className="relative z-10 flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,.05)] md:flex-col md:items-center md:gap-3 md:border-transparent md:bg-transparent md:p-0 md:text-center md:shadow-none">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFF7DC] text-[#D4A000] md:h-12 md:w-12">
                      <step.icon className="h-6 w-6 md:h-5 md:w-5" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1 md:flex-none">
                      <div className="mb-1 flex items-center gap-2 md:justify-center">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFDFA0] text-xs font-bold text-[#B8860B]">{step.id}</span>
                        <h4 className="font-display font-bold text-base leading-tight text-[#2D3139] md:text-sm">
                          {step.title}
                        </h4>
                      </div>
                      <p className="font-sans text-xs leading-relaxed text-gray-500 md:mt-1">
                        {step.desc}
                      </p>
                    </div>
                    <span className="hidden text-[#FFC200] md:block">✦</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* REGLAS & TESTIMONIOS */}
          <section id="reglas-testimonios" className="order-7 scroll-mt-24 w-full pt-8">
            <div id="reglas" className="w-full space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <span className="text-lg">📋</span>
                <h3 className="font-display font-bold text-xl text-[#2D3139]">Reglas principales</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { id: '01', title: 'Respeto ante todo', desc: 'Sé amable y respeta a todos los miembros.' },
                  { id: '02', title: 'Nada de spam', desc: 'No llenes el chat ni publiques tus propias cuentas sin permiso.' },
                  { id: '03', title: 'Protege tu información', desc: 'No compartas datos personales y avisa si alguien te molesta.' }
                ].map(rule => (
                  <div key={rule.id} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,.04)]">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[#FFC200]/15 text-[#D4A000] font-display font-bold text-xs flex items-center justify-center border border-[#FFC200]/20">{rule.id}</span>
                    <div>
                      <h4 className="font-display font-semibold text-sm text-[#2D3139] leading-none">{rule.title}</h4>
                      <p className="font-sans text-xs text-gray-500 leading-snug mt-1">{rule.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowRulesModal(true)}
                className="w-full max-w-sm py-2.5 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-sm rounded-xl transition-all cursor-pointer active:scale-[0.97]"
              >
                Ver reglamento completo 📋
              </button>
            </div>

          </section>

          {/* ADMISIÓN / VIP SECTION */}
          <section id="admision" className="order-9 scroll-mt-24 pt-8">
            {session && !loadingStatus && statusInfo.status === 'approved' ? (
              null
            ) : (
              /* ================= ADMISSIONS CALENDAR / BOOKING ================= */
              <div className="max-w-3xl mx-auto w-full">
                
                {/* IF NOT LOGGED IN ACCORDION PANEL */}
                {!session && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-[0_4px_12px_rgba(0,0,0,.06)] text-center space-y-4">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto">
                      <Lock className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="font-display font-bold text-lg leading-none text-[#2D3139]">Acceso de Admisión</h3>
                    <p className="font-sans text-sm text-gray-500 leading-relaxed">
                      Inicia sesión con Google para agendar tu entrevista de admisión los días viernes y vincular tus cuentas oficiales.
                    </p>
                    <button
                      onClick={handleLogin}
                      className="w-full py-3 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-sm rounded-xl transition-all cursor-pointer active:scale-[0.97]"
                    >
                      🔐 Iniciar Sesión con Google
                    </button>
                  </div>
                )}

                {/* LOADING STATE */}
                {session && loadingStatus && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-[0_4px_12px_rgba(0,0,0,.06)] text-center">
                    <motion.div className="mx-auto w-fit" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
                      <Loader className="w-6 h-6 text-[#FFC200]" />
                    </motion.div>
                    <p className="font-sans text-sm text-gray-400 mt-4">Cargando tu estado...</p>
                  </div>
                )}

                {/* PENDING INTERVIEW STATUS */}
                {session && !loadingStatus && statusInfo.status === 'pending' && !isRescheduling && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_4px_12px_rgba(0,0,0,.06)] space-y-4 text-center">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto">
                      <Clock className="w-6 h-6 text-amber-500 animate-pulse" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-amber-600">Entrevista Agendada</h3>
                    
                    <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl text-left space-y-1.5 font-sans text-sm">
                      {statusInfo.interview_date ? (
                        <>
                          <p className="text-gray-600">
                            📅 Fecha: <span className="font-semibold text-[#2D3139]">{formatDate(statusInfo.interview_date)}</span>
                          </p>
                          <p className="text-gray-600">
                            🕒 Hora: <span className="font-semibold text-[#2D3139]">{statusInfo.interview_time ? formatTime(statusInfo.interview_time) : ''} hs</span>
                          </p>
                        </>
                      ) : (
                        <p className="text-[#2D3139] font-semibold text-xs flex items-center gap-1">
                          ⚡ Aprobación manual pendiente (Ya pasaste entrevista)
                        </p>
                      )}
                      <div className="border-t border-amber-100 pt-2 text-xs text-gray-400">
                        <p>• Roblox: @{statusInfo.roblox_user}</p>
                        <p>• TikTok: @{statusInfo.tiktok_user}</p>
                      </div>
                    </div>
                    <p className="font-sans text-xs text-gray-500 leading-snug">
                      {statusInfo.interview_date 
                        ? 'Milumon te llamará en su transmisión. Ten Roblox abierto y permanece atento al directo.'
                        : 'Tu solicitud de ingreso directo está siendo revisada por los administradores.'
                      }
                    </p>
                    <button
                      onClick={() => {
                        setRobloxUser(statusInfo.roblox_user || '');
                        setTiktokUser(statusInfo.tiktok_user || '');
                        setAlreadyInterviewed(statusInfo.already_interviewed || false);
                        resetRobloxVerification();
                        setIsRescheduling(true);
                      }}
                      className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-display font-semibold text-xs rounded-xl transition-all cursor-pointer mt-2"
                    >
                      Modificar datos / Reprogramar
                    </button>
                  </div>
                )}

                {/* REJECTED STATUS FOR GUESTS */}
                {session && !loadingStatus && statusInfo.status === 'rejected' && !isRescheduling && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_4px_12px_rgba(0,0,0,.06)] space-y-4 text-center">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-red-500 leading-none">Solicitud Rechazada</h3>
                    
                    <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl space-y-1.5 font-sans text-left">
                      <p className="font-semibold text-red-400 text-xs">Motivo brindado:</p>
                      <p className="text-sm text-gray-500 bg-white border border-red-100 p-2 rounded-lg italic">
                        &quot;{statusInfo.rejection_reason || 'Datos inválidos en Roblox/TikTok.'}&quot;
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setRobloxUser(statusInfo.roblox_user || '');
                        setTiktokUser(statusInfo.tiktok_user || '');
                        setIsReturning(false);
                        resetRobloxVerification();
                        setIsRescheduling(true);
                      }}
                      className="w-full py-2.5 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-sm rounded-xl transition-all cursor-pointer active:scale-[0.97]"
                    >
                      Corregir y Re-agendar
                    </button>
                  </div>
                )}

                {/* THE MEMBERSHIP REGISTRATION FORM */}
                {session && !loadingStatus && showBookingForm && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.06)] space-y-4">
                    
                    <div className="border-b border-gray-100 pb-3 text-left">
                      <h3 className="font-display font-bold text-sm flex items-center gap-1.5 text-[#2D3139]">
                        🐣 Unirse a la Comunidad
                      </h3>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">Elige tu tipo de membresía para ingresar</p>
                    </div>

                    {formSuccess && (
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center space-y-2 text-emerald-700">
                        <Check className="w-7 h-7 text-emerald-500 mx-auto" />
                        <p className="font-display font-semibold text-sm">¡Registro completado!</p>
                        <p className="font-sans text-sm text-emerald-600">
                          {memberType === 'pollito_oficial'
                            ? 'Tu solicitud de Pollito Oficial está en revisión por un Administrador.'
                            : '¡Ya eres Pollito Invitado! Tu acceso a la comunidad y Minecraft está activo.'}
                        </p>
                        <button 
                          onClick={() => { setFormSuccess(false); }} 
                          className="font-display font-bold text-[10px] underline cursor-pointer block mx-auto text-[#2D3139]"
                        >
                          VOLVER
                        </button>
                      </div>
                    )}

                    {!formSuccess && (
                      <form onSubmit={handleBook} className="space-y-4">
                        {/* Selector de tipo de miembro */}
                        <div className="space-y-1.5 text-left">
                          <label className="block text-xs font-sans font-bold text-gray-700">¿Qué tipo de miembro eres?</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setMemberType('pollito_invitado')}
                              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                memberType === 'pollito_invitado'
                                  ? 'bg-[#FFF9E6] border-[#FFC200] ring-2 ring-[#FFC200]/40 shadow-sm'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-display font-bold text-sm text-[#2D3139]">🐣 Pollito Invitado</span>
                                <span className="text-xs">{memberType === 'pollito_invitado' ? '✔' : ''}</span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                                Acceso directo para jugar en la comunidad y Minecraft.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setMemberType('pollito_oficial')}
                              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                memberType === 'pollito_oficial'
                                  ? 'bg-[#E8F8F0] border-emerald-500 ring-2 ring-emerald-500/40 shadow-sm'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-display font-bold text-sm text-emerald-800">👑 Pollito Oficial</span>
                                <span className="text-xs text-emerald-600">{memberType === 'pollito_oficial' ? '✔' : ''}</span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                                Ya pasé mi entrevista en directo con Milumon.
                              </p>
                            </button>
                          </div>
                        </div>

                        {/* Nuevo / Reingreso */}
                        <div className="flex border border-gray-200 rounded-xl overflow-hidden text-center text-sm font-display font-semibold">
                          <button
                            type="button"
                            onClick={() => { setIsReturning(false); setFormError(null); }}
                            className={`flex-grow py-1.5 ${!isReturning ? 'bg-[#FFC200] text-black' : 'bg-gray-50 text-gray-400'}`}
                          >
                            Nuevo
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsReturning(true); setFormError(null); }}
                            className={`flex-grow py-1.5 border-l border-gray-200 ${isReturning ? 'bg-red-500 text-white' : 'bg-gray-50 text-gray-400'}`}
                          >
                            Re-Ingreso
                          </button>
                        </div>

                        <div className="space-y-2 text-left">
                          <div>
                            <label className="block text-xs font-sans font-medium text-gray-500 mb-0.5">Usuario Roblox</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={robloxUser}
                                onChange={(e) => {
                                  setRobloxUser(e.target.value);
                                  resetRobloxVerification();
                                }}
                                placeholder="Ej: MilumonRoblox"
                                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC200]/30 text-[#2D3139]"
                              />
                              <button
                                type="button"
                                disabled={verifyingRoblox || !robloxUser.trim()}
                                onClick={handleVerifyRobloxForInterview}
                                className="px-4 py-2 bg-[#2b2d31] hover:bg-neutral-800 text-white font-display font-semibold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer shrink-0"
                              >
                                {verifyingRoblox ? 'Validando...' : 'Validar'}
                              </button>
                            </div>
                          </div>

                          {isDuplicate && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                              <p className="text-xs text-amber-800 font-sans font-medium">
                                Esta cuenta ya está vinculada al correo <span className="font-semibold">{conflictedEmail}</span>. ¿Es tu cuenta de Roblox pero perdiste acceso a tu correo anterior?
                              </p>
                              <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={forceClaim}
                                  onChange={(e) => {
                                    setForceClaim(e.target.checked);
                                    if (e.target.checked) {
                                      setFormError(null);
                                    }
                                  }}
                                  className="rounded text-[#FFC200] focus:ring-[#FFC200]/30"
                                />
                                Solicitar vinculación de todas formas
                              </label>
                              {forceClaim && (
                                <div className="mt-2">
                                  <label className="block text-[10px] font-sans font-semibold text-amber-800 mb-0.5">Explicación del reclamo (opcional)</label>
                                  <textarea
                                    value={claimReason}
                                    onChange={(e) => setClaimReason(e.target.value)}
                                    placeholder="Ej: Perdí mi correo anterior o cambié de cuenta principal"
                                    rows={2}
                                    className="w-full px-2 py-1 bg-white border border-amber-200 rounded-lg font-sans text-xs focus:outline-none text-gray-800"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-sans font-medium text-gray-500 mb-0.5">Usuario TikTok</label>
                            <input
                              type="text"
                              value={tiktokUser}
                              onChange={(e) => setTiktokUser(e.target.value)}
                              placeholder="Ej: @Milumon"
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC200]/30 text-[#2D3139]"
                            />
                          </div>

                          {verifiedRobloxProfile && (
                            <div className={`rounded-xl border p-3 ${robloxProfileConfirmed ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                              <div className="flex items-center gap-3">
                                {verifiedRobloxProfile.avatarUrl ? (
                                  <img
                                    src={verifiedRobloxProfile.avatarUrl}
                                    alt={verifiedRobloxProfile.displayName}
                                    className="w-14 h-14 rounded-xl object-cover border border-white"
                                    style={{ transform: 'scale(1.6) translateY(-8%)', transformOrigin: 'center top', objectPosition: 'center top' }}
                                  />
                                ) : (
                                  <div className="w-14 h-14 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-2xl">
                                    🐣
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-display font-semibold text-sm text-[#2D3139] truncate">
                                    {verifiedRobloxProfile.displayName}
                                  </p>
                                  <p className="font-sans text-xs text-gray-500 truncate">
                                    @{verifiedRobloxProfile.username} · ID {verifiedRobloxProfile.id}
                                  </p>
                                  <p className={`font-sans text-[11px] font-semibold mt-1 ${robloxProfileConfirmed ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {robloxProfileConfirmed ? 'Perfil confirmado' : 'Confirma que este es tu perfil de Roblox'}
                                  </p>
                                </div>
                              </div>

                              {!robloxProfileConfirmed && (
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                  <button
                                    type="button"
                                    onClick={resetRobloxVerification}
                                    className="py-2 bg-white hover:bg-gray-50 text-[#2D3139] border border-gray-200 font-display font-semibold text-xs rounded-xl transition-all cursor-pointer"
                                  >
                                    Editar usuario
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRobloxProfileConfirmed(true);
                                      setFormError(null);
                                    }}
                                    className="py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-display font-semibold text-xs rounded-xl transition-all cursor-pointer"
                                  >
                                    Sí, es mi perfil
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-sans font-medium text-gray-500 mb-0.5">Opinión (opcional)</label>
                            <textarea
                              value={userTestimonial}
                              onChange={(e) => setUserTestimonial(e.target.value.substring(0, 150))}
                              placeholder="Cuéntanos brevemente qué opinas del Team (Máx. 150 caracteres)"
                              rows={2}
                              maxLength={150}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC200]/30 text-[#2D3139]"
                            />
                          </div>

                          {isReturning && (
                            <div className="space-y-2 pt-1 border-t border-gray-100">
                              <div>
                                <label className="block text-xs font-sans font-medium text-gray-500 mb-0.5">¿Motivo del ban?</label>
                                <textarea
                                  value={banReason}
                                  onChange={(e) => setBanReason(e.target.value)}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC200]/30 text-[#2D3139]"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-sans font-medium text-gray-500 mb-0.5">¿Por qué deberías volver?</label>
                                <textarea
                                  value={returnReason}
                                  onChange={(e) => setReturnReason(e.target.value)}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC200]/30 text-[#2D3139]"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {formError && (
                          <div className="bg-red-50 border border-red-100 p-2.5 rounded-xl flex items-start gap-1.5 text-red-500">
                            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <p className="font-sans text-sm">{formError}</p>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submitting || (!robloxProfileConfirmed && !forceClaim)}
                          className={`w-full py-2.5 font-display font-semibold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${isReturning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#FFC200] hover:brightness-105 text-black'} active:scale-[0.97]`}
                        >
                          {submitting ? 'Procesando...' : (memberType === 'pollito_oficial' ? 'Solicitar Pollito Oficial' : 'Unirme como Pollito Invitado')}
                        </button>
                      </form>
                    )}
                  </div>
                )}

              </div>
            )}
          </section>

          {/* SECCIÓN MIEMBROS DE LA COMUNIDAD (OFICIALES E INVITADOS) */}
          <section id="miembros" className="order-9 space-y-6 rounded-2xl border border-gray-200 bg-white p-6 pt-8 shadow-[0_4px_20px_rgba(0,0,0,.06)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-display font-bold text-xl flex items-center gap-2 text-[#2D3139]">
                  👥 Miembros de la Comunidad
                </h3>
                <p className="text-xs text-gray-500 font-sans mt-0.5">
                  Conoce a los integrantes oficiales e invitados del Team Pollito
                </p>
              </div>

              {/* Tabs de Filtro */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl font-display font-semibold text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMembersTab('oficiales')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    membersTab === 'oficiales'
                      ? 'bg-white text-[#2D3139] shadow-sm font-bold'
                      : 'text-gray-500 hover:text-[#2D3139]'
                  }`}
                >
                  👑 Oficiales ({members.filter(m => m.minecraft_rank === 'pollito_oficial' || m.minecraft_rank === 'pollito_moderador' || m.minecraft_rank === 'pollito_admin' || m.is_admin).length})
                </button>
                <button
                  type="button"
                  onClick={() => setMembersTab('invitados')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    membersTab === 'invitados'
                      ? 'bg-white text-[#2D3139] shadow-sm font-bold'
                      : 'text-gray-500 hover:text-[#2D3139]'
                  }`}
                >
                  🐣 Invitados ({members.filter(m => m.minecraft_rank === 'pollito_invitado').length})
                </button>
                <button
                  type="button"
                  onClick={() => setMembersTab('todos')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    membersTab === 'todos'
                      ? 'bg-white text-[#2D3139] shadow-sm font-bold'
                      : 'text-gray-500 hover:text-[#2D3139]'
                  }`}
                >
                  Todos ({members.length})
                </button>
              </div>
            </div>

            {loadingMembers ? (
              <div className="flex justify-center items-center py-12">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
                  <Loader className="w-8 h-8 text-[#FFC200]" />
                </motion.div>
              </div>
            ) : (() => {
              const currentList = members.filter(m => {
                if (membersTab === 'oficiales') {
                  return m.minecraft_rank === 'pollito_oficial' || m.minecraft_rank === 'pollito_moderador' || m.minecraft_rank === 'pollito_admin' || m.is_admin;
                }
                if (membersTab === 'invitados') {
                  return m.minecraft_rank === 'pollito_invitado';
                }
                return true;
              });

              if (currentList.length === 0) {
                return (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <p className="font-sans text-sm text-gray-400">
                      {membersTab === 'oficiales'
                        ? 'No hay miembros oficiales registrados aún.'
                        : membersTab === 'invitados'
                        ? 'No hay pollitos invitados registrados aún.'
                        : 'No hay miembros registrados aún.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="max-h-[380px] overflow-y-auto pr-1.5 scrollbar-thin">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-1">
                    {currentList.map((member) => {
                      const role = getMemberRole(member.roblox_user, member);
                      
                      return (
                        <motion.div
                          key={member.roblox_user}
                          whileHover={{ scale: 1.03, y: -2 }}
                          className="bg-white border border-gray-200/80 p-4 rounded-2xl text-center flex flex-col items-center gap-3 shadow-[0_4px_12px_rgba(0,0,0,.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,.1)] transition-all"
                        >
                          <div className="w-14 h-14 rounded-full border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                            {member.roblox_avatar_url ? (
                              <img
                                src={member.roblox_avatar_url}
                                alt="" aria-hidden="true"
                                className="w-full h-full object-cover"
                                style={{ transform: 'scale(1.6) translateY(-8%)', transformOrigin: 'center top', objectPosition: 'center top' }}
                              />
                            ) : (
                              <span className="text-2xl">🐣</span>
                            )}
                          </div>
                          
                          <div className="w-full">
                            <p className="font-display font-bold text-xs text-[#2D3139] leading-none truncate">
                              {member.roblox_display_name}
                            </p>
                            <p className="font-sans text-[10px] text-gray-400 mt-0.5 truncate">
                              @{member.roblox_user}
                            </p>
                          </div>

                          <span className={`font-sans text-[9px] tracking-wide px-2 py-0.5 rounded-full font-semibold ${getRoleColor(role)}`}>
                            {role}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>

        </div>
      </div>

      {identityModalOpen && session && statusInfo.status === 'approved' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#090a0c]/75 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-2xl rounded-3xl border-2 border-[#FFD500] bg-[#17191e] p-5 text-white shadow-[10px_10px_0_#FFD500] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-[#FFD500]">Miembro Oficial</p>
                <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">Confirma tu identidad</h2>
              </div>
              <span className="text-4xl" aria-hidden="true">🐣</span>
            </div>
            <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-gray-300">
              Este será tu Nombre Oficial dentro de Team Pollito. Se mostrará en Roblox y Minecraft cuando tu cuenta esté vinculada.
            </p>
            {statusInfo.is_admin && statusInfo.roblox_user?.toLowerCase() === 'milumonrt' && (
              <p className="mt-3 rounded-xl border border-[#FFD500]/25 bg-[#FFD500]/10 px-4 py-3 text-xs font-semibold leading-relaxed text-[#FFE98A]">
                Como Administrador, tu nombre se guardará en Team Pollito y Minecraft. Roblox no intentará etiquetar tu propia cuenta.
              </p>
            )}

            <form onSubmit={handleIdentitySubmit} className="mt-6 space-y-5">
              <label className="block text-sm font-bold text-white">
                Nombre Oficial del Team
                <input
                  value={identityDisplayName}
                  onChange={(event) => setIdentityDisplayName(event.target.value)}
                  minLength={MEMBER_DISPLAY_NAME_MIN_LENGTH}
                  maxLength={MEMBER_DISPLAY_NAME_MAX_LENGTH}
                  pattern={MEMBER_DISPLAY_NAME_INPUT_PATTERN}
                  title="Usa letras, números, espacios y, como máximo, un guion bajo en posición intermedia."
                  required
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#25282e] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-[#FFD500]"
                  placeholder="Ejemplo: Pollito123"
                />
                <span className="mt-1 block text-xs font-medium text-gray-500">Usaremos 🐣 {identityDisplayName.trim() || 'TuUsuario'} 🐣</span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#202328] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#FFD500]">Roblox</p>
                  <p className="mt-2 truncate font-black">🐣 {identityDisplayName.trim() || 'TuUsuario'} 🐣</p>
                  <p className="mt-1 truncate text-xs text-gray-500">Cuenta: @{statusInfo.roblox_user}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#202328] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#FFD500]">Minecraft</p>
                  <p className="mt-2 truncate font-black">🐣 {identityDisplayName.trim() || 'TuUsuario'} 🐣</p>
                  <p className="mt-1 text-xs text-gray-500">Se usará cuando apruebes tu cuenta.</p>
                </div>
              </div>

              <label className="block text-sm font-bold text-white">
                Usuario de TikTok
                <div className="mt-2 flex gap-2">
                  <span className="flex items-center rounded-xl border border-white/15 bg-[#25282e] px-3 text-gray-400">@</span>
                  <input
                    value={identityTiktokUser}
                    onChange={(event) => setIdentityTiktokUser(event.target.value.replace(/^@/, ''))}
                    maxLength={24}
                    required
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#25282e] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-[#FFD500]"
                    placeholder="tu_usuario"
                  />
                  <a href={`https://www.tiktok.com/@${identityTiktokUser.replace(/^@/, '').trim()}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center rounded-xl border border-white/15 px-3 text-xs font-bold text-gray-300 transition hover:border-[#FFD500] hover:text-white">Ver perfil</a>
                </div>
              </label>

              <label className="block text-sm font-bold text-white">
                Usuario de Minecraft <span className="font-medium text-gray-500">(opcional)</span>
                <input
                  value={identityMinecraftUsername}
                  onChange={(event) => setIdentityMinecraftUsername(event.target.value)}
                  maxLength={32}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#25282e] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-[#FFD500]"
                  placeholder="Ejemplo: Pollito123"
                />
                <span className="mt-1 block text-xs font-medium text-gray-500">Guardaremos este dato para precargar la vinculación. Todavía no es acceso al servidor.</span>
              </label>

              {identityMinecraftUsername.trim() && (
                <Link href={`/minecraft/link?username=${encodeURIComponent(identityMinecraftUsername.trim())}`} className="block rounded-xl border border-[#FFD500]/40 bg-[#FFD500]/10 px-4 py-3 text-sm font-bold text-[#FFD500] transition hover:bg-[#FFD500]/20">
                  Después podrás vincular {identityMinecraftUsername.trim()} en Minecraft →
                </Link>
              )}

              {identityError && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{identityError}</div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIdentityModalOpen(false)} className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-gray-300 transition hover:bg-white/5">Ahora no</button>
                <button type="submit" disabled={identitySaving} className="rounded-xl bg-[#FFD500] px-5 py-3 text-sm font-black text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{identitySaving ? 'Guardando...' : 'Confirmar mi identidad'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE REGLAS COMPLETAS */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-[0_24px_80px_rgba(0,0,0,0.2)] relative">
            <button
              onClick={() => setShowRulesModal(false)}
              className="absolute top-4 right-4 bg-gray-50 hover:bg-gray-100 rounded-xl w-8 h-8 flex items-center justify-center font-sans text-sm text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
              <span className="text-xl">📋</span>
              <h3 className="font-display font-bold text-xl text-[#2D3139]">Todas las reglas</h3>
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {[
                { id: '01', title: 'Respeto ante todo', desc: 'Sé amable y respeta a todos los miembros.' },
                { id: '02', title: 'Nada de spam', desc: 'No llenes el chat ni publiques tus propias cuentas sin permiso.' },
                { id: '03', title: 'Protege tu información', desc: 'No compartas datos personales y avisa si alguien te molesta.' },
                { id: '04', title: 'Sigue al staff', desc: 'Escucha y respeta las indicaciones de moderadores y administradores.' },
                { id: '05', title: 'Diviértete', desc: 'Disfruta al máximo, apoya a los demás y pásala de 10.' }
              ].map(rule => (
                <div key={rule.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-[#FFC200]/15 text-[#D4A000] font-display font-bold text-xs flex items-center justify-center border border-[#FFC200]/20">{rule.id}</span>
                  <div>
                    <h4 className="font-display font-semibold text-sm text-[#2D3139]">{rule.title}</h4>
                    <p className="font-sans text-xs text-gray-500 leading-snug mt-0.5">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-5 w-full py-2.5 bg-[#FFC200] hover:brightness-105 text-black font-display font-semibold text-sm rounded-xl transition-all cursor-pointer active:scale-[0.97]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE DEJAR / EDITAR OPINIÓN */}
      {showTestimonialModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-[0_24px_80px_rgba(0,0,0,0.2)] relative">
            <button
              onClick={() => {
                setShowTestimonialModal(false);
                setTestimonialError(null);
                setTestimonialSuccess(false);
              }}
              className="absolute top-4 right-4 bg-gray-50 hover:bg-gray-100 rounded-xl w-8 h-8 flex items-center justify-center font-sans text-sm text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
            >
              ✕
            </button>
            
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <span className="text-xl">💬</span>
              <h3 className="font-display font-bold text-xl text-[#2D3139]">
                {statusInfo.testimonial ? 'Editar mi opinión' : '¿Qué opinas de la comunidad?'}
              </h3>
            </div>

            <div className="space-y-4">
              {statusInfo.testimonial && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-left">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-display font-semibold text-xs text-gray-500">Tu opinión enviada:</span>
                    <span className={`font-display font-semibold text-[10px] px-2 py-0.5 rounded-full ${statusInfo.testimonial_approved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {statusInfo.testimonial_approved ? '✓ Aprobado' : '⏳ Pendiente'}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-gray-600 italic border-l-2 border-[#FFC200]/50 pl-2.5">
                    &quot;{statusInfo.testimonial}&quot;
                  </p>
                </div>
              )}

              <form onSubmit={handleSendTestimonial} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="font-display font-semibold text-sm text-[#2D3139] block">
                    Tu comentario
                  </label>
                  <textarea
                    value={userTestimonial}
                    onChange={(e) => setUserTestimonial(e.target.value.substring(0, 150))}
                    placeholder="Escribe tu opinión aquí..."
                    rows={3}
                    maxLength={150}
                    className="w-full px-3 py-2 bg-white border border-gray-200 text-[#2D3139] rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC200]/30 resize-none"
                  />
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>Máx. 150 caracteres. Aparece en la landing una vez aprobado.</span>
                    <span className={userTestimonial.length >= 140 ? 'text-amber-600 font-bold' : ''}>
                      {userTestimonial.length}/150
                    </span>
                  </div>
                </div>

                {testimonialError && (
                  <p className="text-red-500 font-sans text-xs flex items-center gap-1">
                    <span>✕</span> {testimonialError}
                  </p>
                )}
                {testimonialSuccess && (
                  <p className="text-emerald-600 font-sans text-xs flex items-center gap-1">
                    <span>✓</span> Opinión guardada. Pendiente de moderación.
                  </p>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTestimonialModal(false);
                      setTestimonialError(null);
                      setTestimonialSuccess(false);
                    }}
                    className="py-2 px-4 bg-white hover:bg-gray-50 text-[#2D3139] border border-gray-200 font-display font-semibold text-sm rounded-xl transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={testimonialSubmitting || !userTestimonial.trim() || userTestimonial.trim() === statusInfo.testimonial}
                    className="py-2 px-5 bg-[#FFC200] hover:brightness-105 disabled:opacity-50 text-black font-display font-semibold text-sm rounded-xl transition-all cursor-pointer active:scale-[0.97]"
                  >
                    {testimonialSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-16 border-t border-gray-200 py-8 px-6 select-none shrink-0 bg-[#FDFBF7]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🐣</span>
            <span className="font-display font-bold text-sm text-[#2D3139]">Milumon Community</span>
            <span className="text-gray-300">|</span>
            <span className="font-sans text-xs text-gray-400">© 2025</span>
          </div>
          <div className="flex items-center gap-6 font-sans text-sm text-gray-400">
            <Link href="/premios" className="hover:text-[#2D3139] transition-colors">
              🏆 Pollito Awards
            </Link>
            <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" className="hover:text-[#2D3139] transition-colors">Discord</a>
            <a href="https://tiktok.com/@milumon_gaming" target="_blank" rel="noopener noreferrer" className="hover:text-[#2D3139] transition-colors">TikTok</a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#2D3139] transition-colors">YouTube</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
