'use client';

import React, { useEffect, useState } from 'react';
import { Trophy, Crown, Shield, Users, Sparkles, ExternalLink, Gamepad2 } from 'lucide-react';
import Image from 'next/image';

interface MemberItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  minecraftRank?: string | null;
  robloxUser?: string | null;
}

export function MinecraftTopsSection() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'officials' | 'mods' | 'all'>('officials');

  useEffect(() => {
    let active = true;
    fetch('/api/members')
      .then((res) => res.json())
      .then((data: { members?: MemberItem[] }) => {
        if (active && data.members) {
          setMembers(data.members);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const officials = members.filter((m) => m.minecraftRank === 'pollito_oficial');
  const mods = members.filter((m) => m.minecraftRank === 'pollito_moderador' || m.minecraftRank === 'pollito_admin');

  const visibleList = activeTab === 'officials' ? officials : activeTab === 'mods' ? mods : members;

  const getBadge = (rank?: string | null) => {
    if (rank === 'pollito_admin') {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
          <Crown className="w-3 h-3 text-amber-500" /> Admin
        </span>
      );
    }
    if (rank === 'pollito_moderador') {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-300">
          <Shield className="w-3 h-3 text-blue-500" /> Moderador 🛡️
        </span>
      );
    }
    if (rank === 'pollito_oficial') {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-bold text-yellow-700 dark:text-yellow-300">
          👑 Oficial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-400">
        🐣 Invitado
      </span>
    );
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#D4A000]" />
            <h2 className="font-display text-3xl font-black uppercase text-[#2D3139] tracking-tight">
              Padrón & Tops de Jugadores
            </h2>
          </div>
          <p className="text-sm font-semibold text-[#64748B] mt-1">
            Conoce a los miembros del Team Pollito habilitados en el servidor de Minecraft.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 bg-[#FFFDF5] border border-[#E8DFC5] p-1 rounded-2xl shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('officials')}
            className={`px-3.5 py-1.5 rounded-xl font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'officials'
                ? 'bg-[#FFD500] text-black shadow-sm'
                : 'text-[#64748B] hover:text-black'
            }`}
          >
            👑 Oficiales ({officials.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mods')}
            className={`px-3.5 py-1.5 rounded-xl font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'mods'
                ? 'bg-[#FFD500] text-black shadow-sm'
                : 'text-[#64748B] hover:text-black'
            }`}
          >
            🛡️ Staff / Mods ({mods.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#FFD500] text-black shadow-sm'
                : 'text-[#64748B] hover:text-black'
            }`}
          >
            Todos ({members.length})
          </button>
        </div>
      </div>

      {/* Grid of Players */}
      {loading ? (
        <div className="py-16 text-center text-xs font-bold uppercase tracking-wider text-[#9A8D70] animate-pulse">
          Cargando jugadores del servidor...
        </div>
      ) : visibleList.length === 0 ? (
        <div className="py-12 text-center bg-white border border-dashed border-[#E8DFC5] rounded-3xl p-6">
          <p className="font-bold text-[#2D3139] text-sm">Sin jugadores en esta categoría</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleList.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-[#E8DFC5] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-[0_4px_16px_rgba(76,59,18,0.04)] hover:border-[#FFD500] hover:shadow-[0_6px_20px_rgba(76,59,18,0.08)] transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FFF7DC] border border-[#FFDFA0] overflow-hidden flex items-center justify-center shrink-0">
                  {m.avatarUrl ? (
                    <img
                      src={m.avatarUrl}
                      alt={m.name}
                      className="w-full h-full object-cover"
                      style={{ transform: 'scale(1.4) translateY(-5%)' }}
                    />
                  ) : (
                    <span className="text-base">🐣</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-xs text-[#2D3139] truncate">
                    {m.name}
                  </h4>
                  <p className="text-[10px] font-semibold text-[#64748B] truncate">
                    @{m.robloxUser || 'comunidad'}
                  </p>
                </div>
              </div>

              <div>{getBadge(m.minecraftRank)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
