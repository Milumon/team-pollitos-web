'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Session } from '@supabase/supabase-js';
import { Copy, Check, MapPin, Sparkles, ShieldCheck, Crown } from 'lucide-react';

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
  tps?: number;
  mspt?: number;
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

type MinecraftLocation = {
  id: string;
  name: string;
  emoji: string;
  x: number;
  y?: number;
  z: number;
  dimension: string;
  description: string;
};

type UserProfile = {
  roblox_display_name: string | null;
  roblox_user: string | null;
  minecraft_rank: string | null;
  link_status: string;
};

const RANK_LABELS: Record<string, { label: string; perks: string; color: string }> = {
  pollito_invitado: {
    label: '🐥 Pollito Invitado',
    perks: 'Acceso básico al mundo · 1 /sethome',
    color: 'text-neutral-700 bg-neutral-100 border-neutral-300',
  },
  pollito_oficial: {
    label: '👑 Pollito Oficial',
    perks: '3 /sethome · Prefijo dorado [Pollito] · Protecciones prioritarias',
    color: 'text-yellow-800 bg-yellow-100 border-yellow-300',
  },
  pollito_admin: {
    label: '⭐ Pollito Admin',
    perks: 'Permisos de moderación · Teletransporte ilimitado · /fly',
    color: 'text-red-800 bg-red-100 border-red-300',
  },
};

function formatHeartbeat(value?: string | null) {
  if (!value) return 'Sin datos todavía';
  return `Actualizado ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))}`;
}

export default function MinecraftPage() {
  const [status, setStatus] = useState<MinecraftStatus | null>(null);
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [locations, setLocations] = useState<MinecraftLocation[]>([]);
  const [copiedLocation, setCopiedLocation] = useState<string | null>(null);
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
    const loadLocations = async () => {
      try {
        const res = await fetch('/api/minecraft/locations', { cache: 'no-store' });
        if (res.ok && active) {
          const data = await res.json();
          setLocations(data.locations || []);
        }
      } catch {
        // Fallback default locations
      }
    };
    void loadLocations();
    return () => { active = false; };
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
      setAccounts([]);
      setProfile(null);
      return;
    }
    let active = true;

    void fetch('/api/minecraft/link', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { accounts?: MinecraftAccount[] };
      if (active) setAccounts(payload.accounts ?? []);
    });

    void supabase
      .from('profiles')
      .select('roblox_display_name, roblox_user, minecraft_rank, link_status')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setProfile(data as UserProfile);
      });

    return () => { active = false; };
  }, [session]);

  const copyCoordinates = (loc: MinecraftLocation) => {
    const text = `X: ${loc.x}, Y: ${loc.y || 64}, Z: ${loc.z}`;
    navigator.clipboard.writeText(text);
    setCopiedLocation(loc.id);
    setTimeout(() => setCopiedLocation(null), 2500);
  };

  const online = status?.status === 'online' && !status.stale;
  const players = status?.players ?? [];
  const ready = (['java', 'bedrock'] as const).some((edition) =>
    accounts.some((account) => account.edition === edition && account.status === 'approved')
  );
  const playHref = !session ? '/acceso?returnTo=/minecraft' : ready ? '/minecraft/link' : '/minecraft/link';
  const playLabel = ready ? 'Mi cuenta vinculada' : 'Configurar Minecraft';

  const userRankInfo = profile?.minecraft_rank
    ? RANK_LABELS[profile.minecraft_rank] || RANK_LABELS.pollito_invitado
    : RANK_LABELS.pollito_oficial;

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
              <a
                href="#coordenadas"
                className="inline-flex items-center justify-center rounded-xl border-2 border-[#E8DFC5] bg-white px-5 py-3 font-black text-[#64748B] transition hover:border-[#FFD500] hover:text-[#2D3139] cursor-pointer"
              >
                📍 Lugares de Interés
              </a>
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

        {/* ─── Tarjeta de Estado Personalizada (Si está logueado) ─── */}
        {session && (
          <section className="rounded-3xl border-2 border-[#FFD500] bg-[#FFFBEA] p-6 shadow-[6px_6px_0_#FFD500] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0DC9B] pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#B58B00]">Tu Estado en el Servidor</span>
                <h2 className="text-2xl font-black text-[#2D3139] flex items-center gap-2 mt-1">
                  Hola, {profile?.roblox_display_name || 'Pollito'} 👋
                </h2>
              </div>

              <div className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 ${userRankInfo.color}`}>
                <Crown className="w-3.5 h-3.5" /> {userRankInfo.label}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Linked Accounts */}
              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC5] space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9A8D70]">Cuentas Vinculadas</span>
                {accounts.length === 0 ? (
                  <div className="text-sm text-neutral-600">
                    No tienes cuenta vinculada aún.{' '}
                    <Link href="/minecraft/link" className="font-bold text-[#D4A000] underline">
                      Vincular ahora
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {accounts.map((acc) => (
                      <div key={acc.edition} className="flex items-center justify-between text-sm">
                        <span className="font-bold text-[#2D3139]">
                          {acc.edition === 'java' ? '☕ Java' : '📱 Bedrock'}: <code className="text-[#8B6B00]">@{acc.username}</code>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          acc.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : acc.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {acc.status === 'approved' ? '🟢 Aprobada' : acc.status === 'pending' ? '🟡 Pendiente' : '🔴 No activa'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Server Rank Perks */}
              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC5] space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9A8D70]">Beneficios Activos</span>
                <p className="text-sm text-[#2D3139] font-medium leading-relaxed">
                  ✨ {userRankInfo.perks}
                </p>
                <div className="text-xs text-[#9A8D70] pt-1">
                  💡 Protege tus cofres y casas con pala de oro (<code>/claimslist</code>).
                </div>
              </div>
            </div>
          </section>
        )}

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

        {/* ─── Guía Visual de Coordenadas & Zonas del Mundo ─── */}
        <section id="coordenadas" className="scroll-mt-24 rounded-3xl border-2 border-[#D8EACD] bg-[#F7FCF4] p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4F8A3D] flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> Mapa del Servidor
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold text-[#2D3139]">Lugares de Interés & Coordenadas</h2>
              <p className="text-sm text-[#64748B] mt-1">
                Haz clic en <strong>Copiar</strong> para guardar las coordenadas en tu portapapeles y viajar en el juego.
              </p>
            </div>
            <span className="text-3xl">🧭</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc) => {
              const isCopied = copiedLocation === loc.id;
              return (
                <div
                  key={loc.id}
                  className="bg-white rounded-2xl border border-[#D8EACD] p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{loc.emoji}</span>
                      <span className="text-[0.7em] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {loc.dimension === 'overworld' ? 'Overworld' : loc.dimension}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-[#2D3139]">{loc.name}</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">{loc.description}</p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                    <code className="text-xs font-mono font-bold text-[#8B6B00]">
                      X: {loc.x}, Z: {loc.z}
                    </code>
                    <button
                      onClick={() => copyCoordinates(loc)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#FFD500] hover:bg-[#F2C800] text-black shadow-xs'
                      }`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {isCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Community Tops & Members */}
        <MinecraftTopsSection />
      </main>

      {/* Quick Guides Modal */}
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
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFDFA0]">
        {player.avatarUrl ? (
          <Image src={player.avatarUrl} alt="" fill sizes="36px" unoptimized className="h-full w-full object-cover" />
        ) : (
          <span className="text-base" aria-hidden>🐣</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-[#45413A]">{displayName}</p>
        <p className="truncate text-[10px] font-semibold text-[#9A8D70]">{connections || 'Minecraft'}</p>
      </div>
    </article>
  );
}