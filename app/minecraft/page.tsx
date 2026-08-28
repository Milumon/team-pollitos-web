'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Session } from '@supabase/supabase-js';

import { Header } from '@/components/ui/Header';
import { NavBar } from '@/components/ui/NavBar';
import { supabase } from '@/lib/supabaseClient';
import { MinecraftGuidesModal } from '@/components/minecraft/MinecraftGuidesModal';
import { MinecraftInGameCard } from '@/components/minecraft/MinecraftInGameCard';
import { MinecraftTopsSection } from '@/components/minecraft/MinecraftTopsSection';

type MinecraftStatus = {
  status: 'online' | 'offline' | 'unknown';
  stale: boolean;
  playerNames?: string[];
  playerCount?: number;
  maxPlayers?: number;
  lastHeartbeatAt?: string | null;
  players?: MinecraftPlayer[];
};

type MinecraftPlayer = {
  nickname: string | null;
  avatarUrl: string | null;
  java: string | null;
  bedrock: string | null;
};

type MinecraftAccount = {
  edition: 'java' | 'bedrock';
  username: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  verified_at: string | null;
};

function formatHeartbeat(value?: string | null) {
  if (!value) return 'Sin datos todavía';
  return `Actualizado ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))}`;
}

export default function MinecraftPage() {
  const [status, setStatus] = useState<MinecraftStatus | null>(null);
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuidesModalOpen, setIsGuidesModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/minecraft/status', { cache: 'no-store' });
        if (!response.ok) throw new Error('status');
        if (active) {
          setStatus(await response.json() as MinecraftStatus);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void loadStatus();
    const interval = window.setInterval(loadStatus, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      const result = await supabase.auth.getSession();
      if (active) setSession(result.data.session);
    };
    void loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    let active = true;
    void fetch('/api/minecraft/link', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { accounts?: MinecraftAccount[] };
      if (active) setAccounts(payload.accounts ?? []);
    });
    return () => { active = false; };
  }, [session]);

  const online = status?.status === 'online' && !status.stale;
  const players = status?.players ?? [];
  const ready = (['java', 'bedrock'] as const).every((edition) => accounts.some((account) => account.edition === edition && account.status === 'approved' && account.verified_at));
  const playHref = !session ? '/acceso?returnTo=/minecraft' : ready ? '/minecraft/link' : '/minecraft/link';
  const playLabel = ready ? 'Mi cuenta vinculada' : 'Configurar Minecraft';

  const logout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D3139] selection:bg-[#FFB000] selection:text-black">
      <Header
        session={session}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogin={() => window.location.assign('/acceso?returnTo=/minecraft')}
      />
      <NavBar
        variant="drawer"
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        session={session}
        onLogout={logout}
        onLogin={() => window.location.assign('/acceso?returnTo=/minecraft')}
      />

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-8 sm:py-16">
        {/* Hero Section */}
        <section className="grid items-center gap-8 md:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[#D4A000]">
              Minecraft · Servidor Team Pollito
            </p>
            <h1 className="font-display text-5xl font-black uppercase leading-[.9] tracking-tight text-[#2D3139] sm:text-7xl">
              Únete al<br /><span className="text-[#D4A000]">servidor</span>
            </h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-relaxed text-[#64748B] sm:text-lg">
              Un mundo compartido para jugar con la comunidad en Java y Bedrock. Vincula tu cuenta, espera la aprobación y entra a construir.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={playHref}
                className="inline-flex items-center justify-center rounded-xl bg-[#FFD500] px-6 py-4 font-black text-black shadow-[4px_4px_0_#D4A000] transition hover:-translate-y-0.5 cursor-pointer"
              >
                🎮 {playLabel}
              </Link>
              <button
                type="button"
                onClick={() => setIsGuidesModalOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border-2 border-[#E8DFC5] bg-white px-5 py-3 font-black text-[#64748B] transition hover:border-[#FFD500] hover:text-[#2D3139] cursor-pointer"
              >
                📖 Ver guías rápidas
              </button>
            </div>
          </div>
          <div className="relative mx-auto rounded-[2.5rem] bg-[#FFF7DC] p-5 shadow-[10px_10px_0_#FFDFA0]">
            <Image
              src="/images/hero-chick.png"
              alt="Pollito explorador"
              width={288}
              height={288}
              className="h-56 w-56 object-contain sm:h-72 sm:w-72"
            />
            <span className="absolute -bottom-4 -right-4 text-5xl">⛏️</span>
          </div>
        </section>

        {/* Server Connection Data (Pixel/In-Game Style) & Live Status */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr] items-start">
          {/* In-Game Connection Card */}
          <div className="space-y-3">
            <MinecraftInGameCard />
          </div>

          {/* Live Status & Connected Players */}
          <div className="rounded-3xl border border-[#E8DFC5] bg-white p-6 shadow-[0_8px_24px_rgba(76,59,18,.07)] sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E8DFC5] pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#9A8D70]">Estado en Tiempo Real</p>
                <p className={`mt-1 text-2xl font-black ${online ? 'text-emerald-600' : 'text-red-500'}`}>
                  {online ? '🟢 Servidor Online' : '🔴 Sin conexión'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#9A8D70] uppercase">Conectados</span>
                <p className="text-2xl font-mono font-black text-[#D4A000]">
                  {status?.playerCount ?? 0} / {status?.maxPlayers ?? 20}
                </p>
              </div>
            </div>

            {/* Online Players List */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9A8D70] mb-3">Jugadores en el servidor</p>
              {players.length > 0 ? (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {players.map((player) => (
                    <PlayerCard
                      key={`${player.java ?? ''}:${player.bedrock ?? ''}`}
                      player={player}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[#FFFDF5] border border-dashed border-[#E8DFC5] rounded-2xl text-center">
                  <p className="text-xs font-semibold text-[#64748B]">No hay jugadores conectados en este momento.</p>
                  <p className="text-[11px] text-[#9A8D70] mt-0.5">¡Sé el primero en entrar!</p>
                </div>
              )}
            </div>

            <p className="text-[10px] text-[#9A8D70] pt-2 border-t border-[#E8DFC5]">
              {error ? 'No se pudo consultar el estado.' : formatHeartbeat(status?.lastHeartbeatAt)}
            </p>
          </div>
        </section>

        {/* Community Tops & Members */}
        <MinecraftTopsSection />
      </main>

      {/* Guides Modal */}
      <MinecraftGuidesModal
        isOpen={isGuidesModalOpen}
        onClose={() => setIsGuidesModalOpen(false)}
      />
    </div>
  );
}

function PlayerCard({ player }: Readonly<{ player: MinecraftPlayer }>) {
  const displayName = player.nickname || player.java || player.bedrock || 'Pollito';
  const connections = [player.java && `Java: ${player.java}`, player.bedrock && `Bedrock: ${player.bedrock}`].filter(Boolean).join(' · ');
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-[#E8DFC5] bg-[#FFFDF5] p-2.5">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FFDFA0]">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-base">🐣</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-black text-xs text-[#45413A]">{displayName}</p>
        <p className="truncate text-[10px] font-semibold text-[#9A8D70]">{connections || 'Minecraft'}</p>
      </div>
    </article>
  );
}
