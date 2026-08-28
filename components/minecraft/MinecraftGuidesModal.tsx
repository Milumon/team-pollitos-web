'use client';

import React, { useState } from 'react';
import {
  X,
  Home,
  Crown,
  Shield,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Users,
  KeyRound,
  Compass
} from 'lucide-react';

interface MinecraftGuidesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MinecraftGuidesModal({ isOpen, onClose }: MinecraftGuidesModalProps) {
  const [activeTab, setActiveTab] = useState<'claims' | 'roles'>('claims');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-[#1e1f22] border border-neutral-700/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-700/60 bg-[#2b2d31]/80">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📖</span>
            <div>
              <h3 className="font-display font-black text-lg text-white leading-none">Guías Rápidas del Servidor</h3>
              <p className="text-xs text-gray-400 font-medium mt-1">Aprende a proteger tu zona y conoce las ventajas de cada rol.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1e1f22] text-gray-400 hover:text-white border border-neutral-700/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-2 p-3 bg-[#1e1f22] border-b border-neutral-700/40">
          <button
            type="button"
            onClick={() => setActiveTab('claims')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'claims'
                ? 'bg-[#FFC200] text-black shadow-md'
                : 'bg-[#2b2d31] text-gray-300 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            <Home className="w-4 h-4" /> 🏠 Protege tu casita
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-[#FFC200] text-black shadow-md'
                : 'bg-[#2b2d31] text-gray-300 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            <Crown className="w-4 h-4" /> 👑 Roles y Características
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 scrollbar-thin flex-1 text-xs text-gray-300">
          {activeTab === 'claims' ? (
            <div className="space-y-4 animate-fade-in">
              {/* Introduction Card */}
              <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 space-y-2">
                <h4 className="font-display font-bold text-sm text-[#FFC200] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Sistema Anti-Griefing (GriefPrevention)
                </h4>
                <p className="text-gray-300 leading-relaxed">
                  En el servidor de Team Pollito tus construcciones y cofres están 100% protegidos. Nadie puede romper, robar ni colocar lava en tu terreno a menos que tú le des permiso.
                </p>
              </div>

              {/* Step by Step */}
              <div className="space-y-2.5">
                <h5 className="font-display font-bold text-xs uppercase tracking-wider text-gray-400">¿Cómo reclamar tu terreno en 3 pasos?</h5>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-xl p-3.5 space-y-1.5">
                    <span className="w-6 h-6 rounded-lg bg-[#FFC200]/15 text-[#FFC200] font-black font-mono flex items-center justify-center text-xs">1</span>
                    <p className="font-bold text-white text-xs">Consigue una Pala de Oro</p>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      Craftea una pala de oro o usa el comando inicial para obtener tu herramienta de reclamo.
                    </p>
                  </div>

                  <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-xl p-3.5 space-y-1.5">
                    <span className="w-6 h-6 rounded-lg bg-[#FFC200]/15 text-[#FFC200] font-black font-mono flex items-center justify-center text-xs">2</span>
                    <p className="font-bold text-white text-xs">Marca las 2 esquinas</p>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      Haz clic derecho en un bloque de la primera esquina, camina en diagonal y haz clic derecho en la esquina opuesta.
                    </p>
                  </div>

                  <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-xl p-3.5 space-y-1.5">
                    <span className="w-6 h-6 rounded-lg bg-[#FFC200]/15 text-[#FFC200] font-black font-mono flex items-center justify-center text-xs">3</span>
                    <p className="font-bold text-white text-xs">¡Terreno Protegido!</p>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      Verás partículas de oro y diamante marcando los límites de tu nuevo hogar seguro.
                    </p>
                  </div>
                </div>
              </div>

              {/* Essential Commands */}
              <div className="space-y-2 pt-2">
                <h5 className="font-display font-bold text-xs uppercase tracking-wider text-gray-400">Comandos útiles de reclamos</h5>
                
                <div className="space-y-2">
                  {[
                    ['/claimslist', 'Consulta todas tus casitas y cuántos bloques de protección te quedan.'],
                    ['/trust <amigo>', 'Dale permiso completo a un amigo para construir y romper en tu casita.'],
                    ['/containertrust <amigo>', 'Permite a un amigo abrir solo tus cofres, hornos y granjas.'],
                    ['/accesstrust <amigo>', 'Permite a un amigo usar botones, palancas y dormir en tus camas.'],
                    ['/untrust <amigo>', 'Revoca y quita los permisos a un jugador en tu terreno.'],
                    ['/abandonclaim', 'Elimina el reclamo donde estás parado y recupera tus bloques.'],
                  ].map(([cmd, desc]) => (
                    <div
                      key={cmd}
                      className="bg-[#2b2d31] border border-neutral-700/40 rounded-xl p-2.5 flex items-center justify-between gap-3 hover:border-neutral-600 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="font-mono font-bold text-amber-300 text-xs">{cmd}</code>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cmd.split(' ')[0])}
                        className="px-2.5 py-1 rounded-lg bg-[#1e1f22] border border-neutral-700/60 hover:bg-[#35373d] text-gray-300 hover:text-white text-[10px] font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedCommand === cmd.split(' ')[0] ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 animate-fade-in">
              <p className="text-gray-300">
                Los rangos en Minecraft están sincronizados directamente con tu estado y nivel en la comunidad de Team Pollito:
              </p>

              {/* Role 1: Admin / Owner */}
              <div className="bg-[#2b2d31] border border-amber-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs">
                    <Crown className="w-3.5 h-3.5 text-amber-400" /> Admin / Owner
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">Milumon</span>
                </div>
                <p className="text-gray-300 leading-relaxed text-xs">
                  Acceso y control total del servidor, transmisiones y directos, creación de eventos comunitarios y minijuegos.
                </p>
              </div>

              {/* Role 2: Pollito Moderador */}
              <div className="bg-[#2b2d31] border border-blue-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-xs">
                    <Shield className="w-3.5 h-3.5 text-blue-400" /> Pollito Moderador 🛡️
                  </span>
                  <span className="text-[10px] text-blue-400 font-bold">Staff del Servidor</span>
                </div>
                <ul className="space-y-1 text-gray-300 text-xs list-disc list-inside">
                  <li>Herramientas de moderación y control de chat en tiempo real.</li>
                  <li>Asistencia a nuevos jugadores e inspección de casitas.</li>
                  <li>Teletransporte de ayuda y supervisión de normas.</li>
                </ul>
              </div>

              {/* Role 3: Pollito Oficial */}
              <div className="bg-[#2b2d31] border border-yellow-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 font-bold text-xs">
                    👑 Pollito Oficial
                  </span>
                  <span className="text-[10px] text-yellow-400 font-bold">Miembro Aprobado</span>
                </div>
                <ul className="space-y-1 text-gray-300 text-xs list-disc list-inside">
                  <li><strong>Prefijo dorado</strong> distintivo en el chat: <code className="text-yellow-300">[Oficial]</code>.</li>
                  <li>Hasta <strong>3 puntos de teletransporte</strong> (<code className="text-[#FFC200]">/sethome</code>).</li>
                  <li>Mayor cantidad de bloques de protección para casitas y mansiones grandes.</li>
                  <li>Prioridad de entrada en eventos especiales de stream.</li>
                </ul>
              </div>

              {/* Role 4: Pollito Invitado */}
              <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#35373d] border border-neutral-700/60 text-gray-300 font-bold text-xs">
                    🐣 Pollito Invitado
                  </span>
                  <span className="text-[10px] text-gray-400">Acceso Inicial</span>
                </div>
                <ul className="space-y-1 text-gray-300 text-xs list-disc list-inside">
                  <li>Acceso libre al mundo survival compartido en Java y Bedrock.</li>
                  <li><strong>1 punto de casa</strong> (<code className="text-gray-200">/sethome</code>) para regresar en cualquier momento.</li>
                  <li>Protección de casita inicial con Pala de Oro.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#2b2d31]/80 border-t border-neutral-700/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#FFC200] hover:brightness-105 text-black font-display font-bold text-xs transition-all shadow-md cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
