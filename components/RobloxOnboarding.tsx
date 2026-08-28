'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader, AlertTriangle, Clock } from 'lucide-react';

type RobloxOnboardingProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userSession: {
    session: {
      access_token: string;
    } | null;
  } | null;
  currentProfile: {
    displayName: string;
    avatarUrl: string | null;
    username: string | null;
    tiktokUser: string | null;
    linkStatus: string;
    rejectionReason: string | null;
  } | null;
};

type OnboardingStep = 'input' | 'confirming' | 'confirmed' | 'pending_view' | 'rejected_view';

export default function RobloxOnboarding({
  isOpen,
  onClose,
  onConfirm,
  userSession,
  currentProfile,
}: RobloxOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>('input');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [displayData, setDisplayData] = useState<{
    id: number;
    displayName: string;
    avatarUrl: string | null;
  } | null>(null);

  const [isDuplicate, setIsDuplicate] = useState(false);
  const [conflictedEmail, setConflictedEmail] = useState('');
  const [forceClaim, setForceClaim] = useState(false);
  const [claimReason, setClaimReason] = useState('');

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);

    if (isOpen) {
      if (currentProfile) {
        if (currentProfile.linkStatus === 'pending') {
          setStep('pending_view');
        } else if (currentProfile.linkStatus === 'rejected') {
          setStep('rejected_view');
        } else {
          setStep('input');
          setRobloxUsername(currentProfile.username || '');
          setTiktokUsername(currentProfile.tiktokUser || '');
        }
      } else {
        setStep('input');
        setRobloxUsername('');
        setTiktokUsername('');
      }
      setDisplayData(null);
      setError(null);
      setIsDuplicate(false);
      setConflictedEmail('');
      setForceClaim(false);
      setClaimReason('');
    } else {
      setStep('input');
      setRobloxUsername('');
      setTiktokUsername('');
      setDisplayData(null);
      setError(null);
      setIsDuplicate(false);
      setConflictedEmail('');
      setForceClaim(false);
      setClaimReason('');
    }
  }

  const handleVerify = async () => {
    setError(null);
    setIsDuplicate(false);
    setConflictedEmail('');

    if (!robloxUsername.trim()) {
      setError('Por favor ingresá tu nombre de usuario de Roblox');
      return;
    }
    if (!tiktokUsername.trim()) {
      setError('Por favor ingresá tu nombre de usuario de TikTok');
      return;
    }

    setStep('confirming');

    try {
      const response = await fetch('/api/profile/verify-roblox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userSession?.session?.access_token}`,
        },
        body: JSON.stringify({ robloxUsername: robloxUsername.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isDuplicate) {
          setIsDuplicate(true);
          setConflictedEmail(data.conflictedEmail || '');
        }
        setError(data.error || 'No se pudo verificar el usuario de Roblox');
        setStep('input');
        return;
      }

      setDisplayData({
        id: data.id,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
      });
      setStep('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setStep('input');
    }
  };

  const handleConfirmAndLink = async (forceClaimValue?: boolean, claimReasonValue?: string) => {
    setError(null);
    setStep('confirming');

    try {
      const response = await fetch('/api/profile/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userSession?.session?.access_token}`,
        },
        body: JSON.stringify({
          robloxUsername: robloxUsername.trim(),
          tiktokUsername: tiktokUsername.trim(),
          forceClaim: forceClaimValue !== undefined ? forceClaimValue : forceClaim,
          claimReason: claimReasonValue !== undefined ? claimReasonValue : claimReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al vincular las cuentas');
        setStep(isDuplicate ? 'input' : 'confirmed');
        return;
      }

      onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red');
      setStep(isDuplicate ? 'input' : 'confirmed');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-md bg-white border-4 border-black rounded-3xl shadow-lg p-6 relative"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-black rounded-lg bg-white hover:bg-gray-100 active:scale-95 transition-all"
            >
              <X className="w-5 h-5 stroke-[3]" />
            </button>

            {/* HEADER */}
            <div className="mb-5">
              <h2 className="font-display text-2xl text-black uppercase tracking-normal mb-1">
                🐣 Portal de Comunidad
              </h2>
              <p className="font-comic text-xs text-gray-600 uppercase tracking-wider font-bold">
                Vinculá tus cuentas de Roblox y TikTok
              </p>
            </div>

            <AnimatePresence mode="wait">
              {/* STEP 1: INPUT FORM */}
              {step === 'input' && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="bg-yellow-50 border-2 border-black rounded-xl p-3 text-xs font-comic font-bold text-gray-700 leading-relaxed">
                    🔍 Escribí tus usuarios oficiales. Para ser miembro oficial deberás ser aprobado manualmente por Milumon.
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black uppercase mb-1.5 tracking-wide">
                      Usuario de Roblox
                    </label>
                    <input
                      type="text"
                      placeholder="milumon_gaming"
                      value={robloxUsername}
                      onChange={(e) => {
                        setRobloxUsername(e.target.value);
                        setError(null);
                        setIsDuplicate(false);
                        setConflictedEmail('');
                        setForceClaim(false);
                        setClaimReason('');
                      }}
                      className="w-full px-4 py-2.5 border-3 border-black rounded-xl font-comic text-black text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black uppercase mb-1.5 tracking-wide">
                      Usuario de TikTok
                    </label>
                    <input
                      type="text"
                      placeholder="@milumon_gaming"
                      value={tiktokUsername}
                      onChange={(e) => {
                        setTiktokUsername(e.target.value);
                        setError(null);
                      }}
                      className="w-full px-4 py-2.5 border-3 border-black rounded-xl font-comic text-black text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 transition-all"
                    />
                  </div>

                  {isDuplicate && (
                    <div className="bg-amber-50 border-2 border-black rounded-xl p-3 space-y-2">
                      <p className="text-xs font-comic font-bold text-amber-800">
                        Esta cuenta ya está vinculada al correo <span className="underline">{conflictedEmail}</span>. ¿Es tu personaje pero perdiste acceso a tu mail anterior?
                      </p>
                      <label className="flex items-center gap-2 text-xs font-comic font-black text-amber-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceClaim}
                          onChange={(e) => {
                            setForceClaim(e.target.checked);
                            if (e.target.checked) setError(null);
                          }}
                          className="rounded text-orange-500 border-2 border-black focus:ring-orange-500"
                        />
                        Solicitar vinculación de todas formas
                      </label>
                      {forceClaim && (
                        <div className="mt-2">
                          <label className="block text-[10px] font-comic font-black text-amber-800 mb-0.5">Motivo del reclamo (opcional)</label>
                          <textarea
                            value={claimReason}
                            onChange={(e) => setClaimReason(e.target.value)}
                            placeholder="Ej: Perdí mi correo anterior"
                            rows={2}
                            className="w-full px-2 py-1 bg-white border-2 border-black rounded-lg font-comic text-xs text-black focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border-2 border-black p-3 rounded-lg">
                      <p className="text-xs font-comic font-bold text-red-700">⚠️ {error}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={onClose}
                      className="flex-1 px-3 py-3 bg-white text-black border-2 border-black rounded-lg font-comic text-xs uppercase font-black hover:bg-gray-100 active:scale-95 transition-all"
                    >
                      Cancelar
                    </button>
                    {forceClaim ? (
                      <button
                        onClick={() => handleConfirmAndLink(true, claimReason)}
                        className="flex-1 px-3 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-comic text-xs uppercase font-black border-2 border-black active:translate-y-1 transition-all"
                      >
                        ✓ Enviar Solicitud
                      </button>
                    ) : (
                      <button
                        onClick={handleVerify}
                        disabled={!robloxUsername.trim() || !tiktokUsername.trim()}
                        className="flex-1 px-3 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg font-comic text-xs uppercase font-black border-2 border-black active:translate-y-1 disabled:cursor-not-allowed transition-all"
                      >
                        Validar →
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: CONFIRMING / LOADING */}
              {step === 'confirming' && (
                <motion.div
                  key="confirming"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-8"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  >
                    <Loader className="w-10 h-10 text-orange-500" strokeWidth={3} />
                  </motion.div>
                  <p className="mt-4 font-comic text-sm font-bold text-gray-700 uppercase">
                    Procesando datos...
                  </p>
                </motion.div>
              )}

              {/* STEP 3: CONFIRMED PREVIEW */}
              {step === 'confirmed' && displayData && (
                <motion.div
                  key="confirmed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="bg-orange-50 border-4 border-black rounded-2xl p-4 text-center">
                    {displayData.avatarUrl ? (
                      <Image
                        src={displayData.avatarUrl}
                        alt="Avatar"
                        width={80}
                        height={80}
                        unoptimized
                        className="w-20 h-20 rounded-full mx-auto mb-3 object-cover border-3 border-black shadow-md"
                        style={{ transform: 'scale(1.6) translateY(-8%)', transformOrigin: 'center top', objectPosition: 'center top' }}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-yellow-200 border-3 border-black flex items-center justify-center text-3xl">
                        🐣
                      </div>
                    )}
                    <p className="font-display text-xl text-black uppercase leading-none mb-1">
                      {displayData.displayName}
                    </p>
                    <p className="font-comic text-xs text-gray-600 uppercase font-bold mb-3">
                      Roblox ID: {displayData.id}
                    </p>
                    <div className="inline-block bg-black text-[#FFD700] px-3 py-1 text-xs font-comic font-black rounded-full border-2 border-black">
                      TikTok: @{tiktokUsername.replace(/^@/, '')}
                    </div>
                  </div>

                  <div className="bg-yellow-100 border-2 border-dashed border-yellow-600 rounded-lg p-3 text-xs font-comic font-bold text-gray-700 text-center">
                    ¿Confirmás que estas son tus cuentas oficiales?
                  </div>

                  {error && (
                    <div className="bg-red-50 border-2 border-black p-3 rounded-lg">
                      <p className="text-xs font-comic font-bold text-red-700">⚠️ {error}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setStep('input')}
                      className="flex-1 px-3 py-3 bg-white text-black border-2 border-black rounded-lg font-comic text-xs uppercase font-black hover:bg-gray-100 active:scale-95 transition-all"
                    >
                      ← Editar
                    </button>
                    <button
                      onClick={() => handleConfirmAndLink()}
                      className="flex-1 px-3 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-comic text-xs uppercase font-black border-2 border-black active:translate-y-1 transition-all"
                    >
                      ✓ Enviar Solicitud
                    </button>
                  </div>
                </motion.div>
              )}

              {/* PENDING VIEW SCREEN */}
              {step === 'pending_view' && (
                <motion.div
                  key="pending_view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 text-center py-4"
                >
                  <div className="flex justify-center">
                    <div className="w-14 h-14 bg-yellow-100 border-3 border-black rounded-full flex items-center justify-center animate-pulse">
                      <Clock className="w-8 h-8 text-yellow-600 stroke-[3]" />
                    </div>
                  </div>

                  <div className="bg-yellow-50 border-4 border-black rounded-2xl p-4 text-left space-y-2">
                    <h3 className="font-display text-lg text-black uppercase">Solicitud En Revisión</h3>
                    <p className="font-comic text-xs text-gray-700 leading-relaxed font-bold">
                      Tus cuentas ya fueron enviadas a Milumon para su validación manual.
                    </p>
                    <div className="border-t border-black/10 pt-2 text-xs font-comic text-gray-500 space-y-1">
                      <p>• Roblox: <span className="font-bold text-black">@{currentProfile?.username}</span></p>
                      <p>• TikTok: <span className="font-bold text-black">@{currentProfile?.tiktokUser}</span></p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full py-3 bg-white border-2 border-black text-black font-comic text-xs uppercase font-black rounded-lg hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    Cerrar
                  </button>
                </motion.div>
              )}

              {/* REJECTED VIEW SCREEN */}
              {step === 'rejected_view' && (
                <motion.div
                  key="rejected_view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 text-center py-4"
                >
                  <div className="flex justify-center">
                    <div className="w-14 h-14 bg-red-100 border-3 border-black rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-red-600 stroke-[3]" />
                    </div>
                  </div>

                  <div className="bg-red-50 border-4 border-black rounded-2xl p-4 text-left space-y-2">
                    <h3 className="font-display text-lg text-red-700 uppercase">Solicitud Rechazada</h3>
                    <p className="font-comic text-xs text-red-700 leading-relaxed font-bold">
                      Motivo del rechazo:
                    </p>
                    <div className="bg-white border-2 border-black p-3 rounded-xl">
                      <p className="font-comic text-xs font-bold text-slate-800 italic">
                        &quot;{currentProfile?.rejectionReason || 'No especificado'}&quot;
                      </p>
                    </div>
                    <div className="border-t border-black/10 pt-2 text-xs font-comic text-gray-500 space-y-1">
                      <p>• Roblox original: <span className="font-bold text-black">@{currentProfile?.username}</span></p>
                      <p>• TikTok original: <span className="font-bold text-black">@{currentProfile?.tiktokUser}</span></p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 bg-white border-2 border-black text-black font-comic text-xs uppercase font-black rounded-lg hover:bg-gray-100 active:scale-95 transition-all"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={() => setStep('input')}
                      className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-comic text-xs uppercase font-black border-2 border-black active:translate-y-1 transition-all"
                    >
                      Corregir y Re-enviar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
