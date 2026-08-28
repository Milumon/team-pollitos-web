'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Session } from '@supabase/supabase-js';

import { Header } from '@/components/ui/Header';
import { NavBar } from '@/components/ui/NavBar';
import { supabase } from '@/lib/supabaseClient';

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
  const playHref = !session ? '/acceso?returnTo=/minecraft' : ready ? '/minecraft/guias#como-entrar' : '/minecraft/link';
  const playLabel = ready ? 'Entrar al servidor' : 'Configurar Minecraft';

  const logout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D3139] selection:bg-[#FFB000] selection:text-black">
      <Header session={session} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} onLogin={() => window.location.assign('/acceso?returnTo=/minecraft')} />
      <NavBar variant="drawer" isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} session={session} onLogout={logout} onLogin={() => window.location.assign('/acceso?returnTo=/minecraft')} />

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-8 sm:py-16">
        <section className="grid items-center gap-8 md:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[#D4A000]">Minecraft · Servidor Team Pollito</p>
            <h1 className="font-display text-5xl font-black uppercase leading-[.9] tracking-tight text-[#2D3139] sm:text-7xl">Únete al<br /><span className="text-[#D4A000]">servidor</span></h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-relaxed text-[#64748B] sm:text-lg">Un mundo compartido para jugar con la comunidad en Java y Bedrock. Vincula tu cuenta, espera la aprobación y entra a construir.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3"><Link href={playHref} className="inline-flex items-center justify-center rounded-xl bg-[#FFD500] px-6 py-4 font-black text-black shadow-[4px_4px_0_#D4A000] transition hover:-translate-y-0.5">🎮 {playLabel}</Link><a href="#guias" className="inline-flex items-center justify-center rounded-xl border-2 border-[#E8DFC5] bg-white px-5 py-3 font-black text-[#64748B] transition hover:border-[#FFD500]">Ver guías rápidas</a></div>
          </div>
          <div className="relative mx-auto rounded-[2.5rem] bg-[#FFF7DC] p-5 shadow-[10px_10px_0_#FFDFA0]"><Image src="/images/hero-chick.png" alt="Pollito explorador" width={288} height={288} className="h-56 w-56 object-contain sm:h-72 sm:w-72" /><span className="absolute -bottom-4 -right-4 text-5xl">⛏️</span></div>
        </section>

        <section className="grid gap-5 md:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border-2 border-[#FFD500] bg-white p-6 shadow-[8px_8px_0_#FFD500] sm:p-8">
             <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-[#9A8D70]">Disponibilidad</p><p className={`mt-2 text-4xl font-black ${online ? 'text-emerald-500' : 'text-red-400'}`}>{online ? 'Servidor online' : 'Sin conexión'}</p></div><span className="rounded-full bg-[#FFFDF5] px-4 py-2 text-sm font-black text-[#D4A000]">🎮 Java + Bedrock</span></div>
             <div className="mt-7 grid gap-3 sm:grid-cols-2"><Metric label="Jugadores conectados" value={`${status?.playerCount ?? 0}/${status?.maxPlayers ?? 20}`} /><Metric label="Tipo de mundo" value="Persistente" /></div>
             <p className="mt-5 text-xs text-[#9A8D70]">{error ? 'No se pudo consultar el estado.' : formatHeartbeat(status?.lastHeartbeatAt)}</p>
             <div className="mt-5 border-t border-[#E8DFC5] pt-4"><p className="text-xs font-bold uppercase tracking-widest text-[#9A8D70]">Direcciones para conectarte</p><div className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><p>Java: <code className="font-mono font-black text-[#8B6B00]">mc.milumon.dev:25565</code></p><p>Bedrock: <code className="font-mono font-black text-[#8B6B00]">mc.milumon.dev:19132</code></p></div><p className="mt-2 text-xs text-[#9A8D70]">Úsalas cuando tu cuenta de Minecraft haya sido aprobada.</p></div>
          </div>
            <div className="rounded-3xl border border-[#E8DFC5] bg-white p-6 shadow-[0_8px_24px_rgba(76,59,18,.07)] sm:p-8"><p className="text-sm font-bold uppercase tracking-widest text-[#9A8D70]">Jugadores conectados</p>{players.length > 0 ? <div className="mt-5 space-y-3">{players.map((player) => <PlayerCard key={`${player.java ?? ''}:${player.bedrock ?? ''}`} player={player} />)}</div> : <p className="mt-5 text-[#64748B]">No hay jugadores conectados ahora.</p>}</div>
        </section>

          <section id="guias" className="scroll-mt-24 rounded-3xl border-2 border-[#B9E6A4] bg-[#F4FBEF] p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#4F8A3D]">Ayuda para jugar</p><h2 className="mt-1 font-display text-3xl font-bold">Guías rápidas</h2></div><span className="text-3xl">📖</span></div><div className="mt-5 grid gap-3 md:grid-cols-3"><GuideDetails icon="🏡" title="Protege tu casita"><p>Usa una pala de oro para marcar las dos esquinas de tu terreno. Después puedes consultar tus terrenos con <code>/claimslist</code>.</p></GuideDetails><GuideDetails icon="🎮" title="Cómo entrar"><p>Vincula tu cuenta en la web y, cuando esté aprobada, usa la dirección de tu edición: Java <code>mc.milumon.dev:25565</code> o Bedrock <code>mc.milumon.dev:19132</code>.</p></GuideDetails><GuideDetails icon="❓" title="Si tienes un problema"><p>Prueba <code>/help</code>. Si AuthMe lo solicita, usa <code>/login</code> o <code>/register</code> con la contraseña que registraste.</p></GuideDetails></div></section>
      </main>
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) { return <div className="rounded-xl border border-[#E8DFC5] bg-[#FFFDF5] p-4"><p className="text-xs uppercase tracking-widest text-[#9A8D70]">{label}</p><p className="mt-2 text-2xl font-black text-[#D4A000]">{value}</p></div>; }
function GuideDetails({ icon, title, children }: Readonly<{ icon: string; title: string; children: ReactNode }>) { return <details className="rounded-2xl border border-[#D8EACD] bg-white p-4"><summary className="cursor-pointer font-bold text-[#45413A]"><span className="mr-2 text-xl" aria-hidden>{icon}</span>{title}</summary><div className="mt-3 text-sm font-medium leading-relaxed text-[#64748B]">{children}</div></details>; }
function PlayerCard({ player }: Readonly<{ player: MinecraftPlayer }>) {
  const displayName = player.nickname || player.java || player.bedrock || 'Pollito';
  const connections = [player.java && `Java: ${player.java}`, player.bedrock && `Bedrock: ${player.bedrock}`].filter(Boolean).join(' · ');
  return <article className="flex items-center gap-3 rounded-2xl border border-[#E8DFC5] bg-[#FFFDF5] p-3"><div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFDFA0]">{player.avatarUrl ? <Image src={player.avatarUrl} alt="" fill sizes="44px" unoptimized className="h-full w-full object-cover" /> : <span className="text-xl" aria-hidden>🐣</span>}</div><div className="min-w-0"><p className="truncate font-black text-[#45413A]">{displayName}</p><p className="truncate text-xs font-semibold text-[#9A8D70]">{connections || 'Minecraft'}</p></div></article>;
}
