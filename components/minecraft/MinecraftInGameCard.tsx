'use client';

import React, { useState } from 'react';
import { Copy, Check, Gamepad2, Smartphone, Monitor } from 'lucide-react';

export function MinecraftInGameCard() {
  const [edition, setEdition] = useState<'java' | 'bedrock'>('java');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyValue = (field: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const serverName = 'Team Pollito';
  const serverAddress = 'mc.milumon.dev';
  const bedrockPort = '19132';

  return (
    <div className="bg-[#141517] border-2 border-neutral-700/80 rounded-2xl p-5 shadow-2xl space-y-4 text-white font-sans">
      {/* Platform Switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          <span className="font-display font-bold text-xs uppercase tracking-wider text-gray-300">
            Conectar al Servidor
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl border border-neutral-700/60">
          <button
            type="button"
            onClick={() => setEdition('java')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              edition === 'java'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Java (PC)
          </button>
          <button
            type="button"
            onClick={() => setEdition('bedrock')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              edition === 'bedrock'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Bedrock (Móvil/Consola)
          </button>
        </div>
      </div>

      {/* Minecraft In-Game Input Box Style */}
      <div className="space-y-3.5">
        {/* Field 1: Server Name */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-gray-300 tracking-wide font-mono">
            Nombre del servidor
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black border-2 border-neutral-500 rounded px-3 py-2 text-sm font-mono text-white select-all shadow-inner">
              {serverName}
            </div>
            <button
              type="button"
              onClick={() => copyValue('name', serverName)}
              className="px-3 py-2 bg-[#2b2d31] hover:bg-[#35373d] border border-neutral-600 rounded text-xs font-bold text-gray-200 hover:text-white transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              title="Copiar nombre"
            >
              {copiedField === 'name' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Field 2: Server Address */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-gray-300 tracking-wide font-mono">
            Dirección del servidor
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black border-2 border-neutral-500 rounded px-3 py-2 text-sm font-mono font-bold text-[#FFC200] select-all shadow-inner">
              {serverAddress}
            </div>
            <button
              type="button"
              onClick={() => copyValue('address', serverAddress)}
              className="px-3.5 py-2 bg-[#FFC200] hover:brightness-105 text-black rounded text-xs font-black transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
              title="Copiar IP del servidor"
            >
              {copiedField === 'address' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black" /> ¡Copiada!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copiar IP
                </>
              )}
            </button>
          </div>
        </div>

        {/* Field 3 (Bedrock Only): Port */}
        {edition === 'bedrock' && (
          <div className="space-y-1 animate-fade-in">
            <label className="block text-xs font-bold text-gray-300 tracking-wide font-mono">
              Puerto
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black border-2 border-neutral-500 rounded px-3 py-2 text-sm font-mono text-emerald-400 select-all shadow-inner">
                {bedrockPort}
              </div>
              <button
                type="button"
                onClick={() => copyValue('port', bedrockPort)}
                className="px-3 py-2 bg-[#2b2d31] hover:bg-[#35373d] border border-neutral-600 rounded text-xs font-bold text-gray-200 hover:text-white transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                title="Copiar puerto"
              >
                {copiedField === 'port' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 pt-1 leading-snug">
        💡 {edition === 'java' ? 'En Java no necesitas escribir ningún puerto; el cliente detecta el puerto estándar automáticamente.' : 'En Bedrock (celular o consola), agrega el servidor con la IP y el puerto 19132.'}
      </p>
    </div>
  );
}
