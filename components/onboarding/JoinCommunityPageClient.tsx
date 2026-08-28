'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Check,
  ShieldCheck,
  Gamepad2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Loader2,
  LogIn,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { buildAccessPath } from '@/lib/authRouting';

type VerifiedRoblox = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  username: string;
};

export default function JoinCommunityPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSource = searchParams?.get('from');

  // Auth states
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userStatus, setUserStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [userRank, setUserRank] = useState<string | null>(null);

  // Form states
  const [memberType, setMemberType] = useState<'pollito_invitado' | 'pollito_oficial'>('pollito_invitado');
  const [isReturning, setIsReturning] = useState(false);
  const [robloxUser, setRobloxUser] = useState('');
  const [tiktokUser, setTiktokUser] = useState('');
  const [userTestimonial, setUserTestimonial] = useState('');
  const [banReason, setBanReason] = useState('');
  const [returnReason, setReturnReason] = useState('');

  // Roblox verification states
  const [verifyingRoblox, setVerifyingRoblox] = useState(false);
  const [verifiedRobloxProfile, setVerifiedRobloxProfile] = useState<VerifiedRoblox | null>(null);
  const [robloxProfileConfirmed, setRobloxProfileConfirmed] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [conflictedEmail, setConflictedEmail] = useState('');
  const [forceClaim, setForceClaim] = useState(false);
  const [claimReason, setClaimReason] = useState('');

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (currentSession?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('link_status, minecraft_rank, roblox_user, roblox_display_name, roblox_avatar_url')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (profile) {
            setUserStatus((profile.link_status as any) || 'none');
            setUserRank(profile.minecraft_rank || null);
            if (profile.roblox_user) {
              setRobloxUser(profile.roblox_user);
              setVerifiedRobloxProfile({
                id: 0,
                displayName: profile.roblox_display_name || profile.roblox_user,
                avatarUrl: profile.roblox_avatar_url,
                username: profile.roblox_user,
              });
              setRobloxProfileConfirmed(true);
            }
          }
        }
      } catch (err) {
        console.error('Error checking user status:', err);
      } finally {
        setLoadingAuth(false);
      }
    }

    void checkUser();
  }, []);

  const handleVerifyRoblox = async () => {
    setFormError(null);
    setIsDuplicate(false);
    setConflictedEmail('');

    if (!robloxUser.trim()) {
      setFormError('Ingresa tu usuario de Roblox primero.');
      return;
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
        setFormError(data.error || 'No se pudo validar el usuario de Roblox.');
        return;
      }

      setVerifiedRobloxProfile({
        id: data.id,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl || null,
        username: robloxUser.trim(),
      });
      setRobloxProfileConfirmed(true);
    } catch {
      setFormError('Ocurrió un error al consultar Roblox. Intenta nuevamente.');
    } finally {
      setVerifyingRoblox(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!session) {
      window.location.assign(buildAccessPath('/unirse'));
      return;
    }

    if (!robloxUser.trim()) {
      setFormError('El usuario de Roblox es obligatorio.');
      return;
    }
    if (!tiktokUser.trim()) {
      setFormError('El usuario de TikTok es obligatorio.');
      return;
    }
    if (!robloxProfileConfirmed) {
      await handleVerifyRoblox();
      return;
    }

    try {
      setSubmitting(true);
      const token = session?.access_token;
      const res = await fetch('/api/interviews/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
          claimReason: forceClaim ? claimReason.trim() : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Error al registrar la membresía.');
        return;
      }

      setFormSuccess(true);
      setUserStatus(memberType === 'pollito_invitado' ? 'approved' : 'pending');
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#111318] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 text-[#FFC200] animate-spin" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cargando estado...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#111318] text-gray-200 flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden font-sans">
      
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FFC200]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10 space-y-6 animate-fade-in my-8">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-[#FFC200]/40 transition text-xs font-bold text-gray-300">
            <span>← Volver al Inicio</span>
          </Link>

          <h1 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight flex items-center justify-center gap-2.5">
            🐣 Unirse al Team Pollito
          </h1>
          <p className="text-sm text-gray-400 font-medium max-w-md mx-auto">
            Elige tu membresía para formar parte de la comunidad oficial de Milumon y acceder al servidor de Minecraft.
          </p>
        </div>

        {/* Source Hint for Minecraft */}
        {fromSource === 'minecraft' && !formSuccess && userStatus !== 'approved' && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center gap-3">
            <Gamepad2 className="w-5 h-5 text-[#FFC200] shrink-0" />
            <div>
              <strong className="text-white block font-bold">¡Estás a un paso de jugar en Minecraft!</strong>
              Completa tu registro como <strong>Pollito Invitado</strong> (es gratis e instantáneo) para poder vincular tu usuario.
            </div>
          </div>
        )}

        {/* User Already Approved Card */}
        {userStatus === 'approved' && !formSuccess && (
          <div className="p-6 rounded-3xl bg-[#1e2026] border border-emerald-500/40 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-2xl">
              ✓
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-white">¡Ya eres miembro del Team Pollito!</h2>
              <p className="text-xs text-gray-400 mt-1">
                Tu cuenta está activa con rango <strong className="text-[#FFC200]">{userRank || 'Pollito Invitado'}</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/minecraft/link"
                className="flex-1 py-3 px-4 bg-[#FFC200] hover:brightness-105 text-black font-display font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Gamepad2 className="w-4 h-4" /> Configurar Cuenta de Minecraft
              </Link>
              <Link
                href="/minecraft"
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-display font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-white/10"
              >
                🗺️ Hub de Minecraft
              </Link>
            </div>
          </div>
        )}

        {/* User Pending Review Card */}
        {userStatus === 'pending' && !formSuccess && (
          <div className="p-6 rounded-3xl bg-[#1e2026] border border-amber-500/40 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center text-2xl">
              ⏳
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-white">Solicitud en Revisión</h2>
              <p className="text-xs text-gray-400 mt-1">
                Tu postulación para <strong>Pollito Oficial</strong> está siendo evaluada por los administradores.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/minecraft"
                className="inline-flex py-3 px-6 bg-[#FFC200] hover:brightness-105 text-black font-display font-bold text-xs rounded-xl transition items-center justify-center gap-2"
              >
                Ver Servidor de Minecraft
              </Link>
            </div>
          </div>
        )}

        {/* Success Screen After Submit */}
        {formSuccess && (
          <div className="p-6 rounded-3xl bg-[#1e2026] border border-emerald-500/50 shadow-2xl text-center space-y-5 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-3xl shadow-inner">
              🎉
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-white">¡Bienvenido al Team Pollito!</h2>
              <p className="text-xs text-emerald-300 mt-1.5 font-medium">
                {memberType === 'pollito_invitado'
                  ? '¡Tu acceso como Pollito Invitado está activo inmediatamente!'
                  : 'Tu solicitud de Pollito Oficial ha sido enviada para validación.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <Link
                href="/minecraft/link"
                className="flex-1 py-3 px-4 bg-[#FFC200] hover:brightness-105 text-black font-display font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Gamepad2 className="w-4 h-4" /> Vincular Cuenta de Minecraft
              </Link>
              <Link
                href="/minecraft"
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-display font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-white/10"
              >
                Explorar Hub y Tops
              </Link>
            </div>
          </div>
        )}

        {/* Main Onboarding Form */}
        {userStatus !== 'approved' && userStatus !== 'pending' && !formSuccess && (
          <div className="bg-[#1e2026] border border-neutral-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            {/* Step 1: Membership Type Selection */}
            <div className="space-y-3">
              <label className="text-xs font-display font-bold text-gray-300 uppercase tracking-wider block">
                1. Elige tu tipo de membresía
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Option: Pollito Invitado */}
                <button
                  type="button"
                  onClick={() => setMemberType('pollito_invitado')}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    memberType === 'pollito_invitado'
                      ? 'border-[#FFC200] bg-[#FFC200]/15 ring-2 ring-[#FFC200]/30 shadow-lg'
                      : 'border-neutral-700/60 bg-[#16181d] text-gray-400 hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      🐣 Pollito Invitado
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#FFC200] text-black">
                      INSTANTÁNEO
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    Acceso directo para jugar en la comunidad y en el servidor de Minecraft.
                  </p>
                </button>

                {/* Option: Pollito Oficial */}
                <button
                  type="button"
                  onClick={() => setMemberType('pollito_oficial')}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    memberType === 'pollito_oficial'
                      ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30 shadow-lg'
                      : 'border-neutral-700/60 bg-[#16181d] text-gray-400 hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                      👑 Pollito Oficial
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-black">
                      CON ENTREVISTA
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    Para miembros que ya pasaron su entrevista en directo con Milumon.
                  </p>
                </button>
              </div>
            </div>

            {/* Step 2: Form Details */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-neutral-700/60">
              
              {/* Type Switcher: Nuevo / Reingreso */}
              <div className="flex border border-neutral-700/60 rounded-xl overflow-hidden text-center text-xs font-display font-bold">
                <button
                  type="button"
                  onClick={() => { setIsReturning(false); setFormError(null); }}
                  className={`flex-grow py-2 transition cursor-pointer ${
                    !isReturning ? 'bg-[#FFC200] text-black' : 'bg-[#16181d] text-gray-400 hover:text-white'
                  }`}
                >
                  Nuevo Miembro
                </button>
                <button
                  type="button"
                  onClick={() => { setIsReturning(true); setFormError(null); }}
                  className={`flex-grow py-2 border-l border-neutral-700/60 transition cursor-pointer ${
                    isReturning ? 'bg-red-500 text-white' : 'bg-[#16181d] text-gray-400 hover:text-white'
                  }`}
                >
                  Re-Ingreso / Apelación
                </button>
              </div>

              {/* Roblox Username with Validation */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex justify-between">
                  <span>Usuario de Roblox</span>
                  <span className="text-[10px] text-gray-400">Requerido para el avatar</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={robloxUser}
                    onChange={(e) => {
                      setRobloxUser(e.target.value);
                      setRobloxProfileConfirmed(false);
                      setVerifiedRobloxProfile(null);
                    }}
                    placeholder="Ej: MilumonRoblox"
                    className="flex-1 px-3.5 py-2.5 bg-[#16181d] border border-neutral-700/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC200] transition"
                  />
                  <button
                    type="button"
                    disabled={verifyingRoblox || !robloxUser.trim()}
                    onClick={handleVerifyRoblox}
                    className="px-4 py-2.5 bg-[#FFC200] hover:brightness-105 text-black font-display font-bold text-xs rounded-xl transition disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {verifyingRoblox ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validar'}
                  </button>
                </div>

                {/* Roblox Avatar Preview Card */}
                {verifiedRobloxProfile && (
                  <div className="p-3 bg-[#16181d] border border-emerald-500/40 rounded-xl flex items-center gap-3 animate-in fade-in">
                    {verifiedRobloxProfile.avatarUrl ? (
                      <img
                        src={verifiedRobloxProfile.avatarUrl}
                        alt={verifiedRobloxProfile.displayName}
                        className="w-10 h-10 rounded-lg bg-neutral-800 object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-lg">
                        🐣
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {verifiedRobloxProfile.displayName}
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">@{verifiedRobloxProfile.username}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* TikTok Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">
                  Usuario de TikTok
                </label>
                <input
                  type="text"
                  value={tiktokUser}
                  onChange={(e) => setTiktokUser(e.target.value)}
                  placeholder="Ej: @Milumon"
                  className="w-full px-3.5 py-2.5 bg-[#16181d] border border-neutral-700/60 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC200] transition"
                />
              </div>

              {/* Returning Fields */}
              {isReturning && (
                <div className="space-y-3 p-3.5 bg-red-950/20 border border-red-500/30 rounded-xl animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-red-300">¿Por qué fuiste sancionado?</label>
                    <textarea
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Explica qué ocurrió..."
                      rows={2}
                      className="w-full px-3 py-2 bg-[#16181d] border border-red-500/30 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-red-300">¿Por qué deseas reingresar?</label>
                    <textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Compromiso con la comunidad..."
                      rows={2}
                      className="w-full px-3 py-2 bg-[#16181d] border border-red-500/30 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Testimonial / Opinion */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex justify-between">
                  <span>Opinión o Mensaje (Opcional)</span>
                  <span className="text-[10px] text-gray-400">{userTestimonial.length}/150</span>
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={userTestimonial}
                  onChange={(e) => setUserTestimonial(e.target.value)}
                  placeholder="Cuéntanos qué opinas del Team Pollito..."
                  className="w-full px-3.5 py-2 bg-[#16181d] border border-neutral-700/60 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC200] transition"
                />
              </div>

              {/* Error Box */}
              {formError && (
                <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-[#FFC200] hover:brightness-105 text-black font-display font-black text-sm rounded-xl transition cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                  </>
                ) : memberType === 'pollito_oficial' ? (
                  'Solicitar Pollito Oficial'
                ) : (
                  '🐣 Unirme como Pollito Invitado'
                )}
              </button>

              <p className="text-[11px] text-gray-400 text-center">
                Al unirte aceptas las normas de convivencia del Team Pollito y el servidor de Minecraft.
              </p>
            </form>
          </div>
        )}

      </div>
    </main>
  );
}
