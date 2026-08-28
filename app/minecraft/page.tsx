'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Session } from '@supabase/supabase-js';
import { Copy, Check, MapPin, Sparkles, ShieldCheck, Crown, Trophy, Server, Compass, BookOpen, ArrowRight } from 'lucide-react';

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
  pollito_admin: { label: 'Pollito Admin 👑', perks: 'Acceso total y moderación', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  pollito_mod: { label: 'Pollito Mod 🛡️', perks: 'Herramientas de moderación', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  pollito_vip: { label: 'Pollito VIP 💎', perks: 'Comandos cosméticos y parcelas extra', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  pollito_oficial: { label: 'Pollito Oficial 🐣', perks: 'Acceso survival y parcelas', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  pollito_invitado: { label: 'Pollito Invitado 🎮', perks: 'Acceso de prueba temporal', color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
};

type MinecraftTab = 'server' | 'tops' | 'locations' | 'guides';

export default function MinecraftPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<MinecraftStatus | null>(null);
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [locations, setLocations] = useState<MinecraftLocation[]>([]);
  const [copiedLocation, setCopiedLocation] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [isGuidesModalOpen, setIsGuidesModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MinecraftTab>('server');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    fetch('/api/minecraft/status')
      .then((res) => res.json())
      .then((data) => {
        if (active) setStatus(data as MinecraftStatus);
      })
      .catch(() => {
        if (active) setStatus({ status: 'unknown', stale: true });
      });

    fetch('/api/minecraft/locations')
      .then((res) => res.json())
      .then((data: { locations?: MinecraftLocation[] }) => {
        if (active && Array.isArray(data.locations)) {
          setLocations(data.locations);
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) {
      setAccounts([]);
      setProfile(null);
      return;
    }

    let active = true;

    fetch('/api/minecraft/link').then(async (response) => {
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

  const copyCommandText = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const online = status?.status === 'online' && !status.stale;
  const players = status?.players ?? [];
  const ready = (['java', 'bedrock'] as const).some((edition) =>
    accounts.some((account) => account.edition === edition && account.status === 'approved')
  );
  const playHref = !session ? '/acceso?returnTo=/minecraft' : '/minecraft/link';
  const playLabel = 'Configurar Cuenta';

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

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
        {/* Compact Hero Banner */}
        <section className="grid items-center gap-6 md:grid-cols-[1.2fr_.8fr] rounded-3xl border border-[#E8DFC5] bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,.04)]">
          <div>
            <p className="mb-2 font-display text-xs font-bold uppercase tracking-[0.25em] text-[#D4A000]">
              Minecraft · Servidor Team Pollito
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#2D3139] leading-[1]">
              Mundo <span className="text-[#D4A000]">Survival</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm font-semibold leading-relaxed text-[#64748B]">
              Construye, explora y compite en nuestro mundo compartido para Java y Bedrock.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href={playHref}
                className="inline-flex items-center justify-center rounded-xl bg-[#FFD500] px-5 py-2.5 text-xs font-black text-black shadow-[3px_3px_0_#D4A000] transition hover:-translate-y-0.5 cursor-pointer"
              >
                🎮 {playLabel}
              </Link>
              <button
                type="button"
                onClick={() => setIsGuidesModalOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-[#FDFBF7] px-4 py-2.5 text-xs font-bold text-[#64748B] hover:border-[#FFD500] hover:text-black transition cursor-pointer"
              >
                📖 Guía de Protección y Roles
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-end">
            <div className="relative rounded-3xl bg-[#FFF7DC] p-4 shadow-sm border border-[#FFDFA0]">
              <Image
                src="/images/hero-chick.png"
                alt="Pollito explorador"
                width={160}
                height={160}
                className="h-32 w-32 object-contain sm:h-40 sm:w-40"
              />
              <span className="absolute -bottom-2 -right-2 text-3xl">⛏️</span>
            </div>
          </div>
        </section>

        {/* ─── Pestañas de Navegación del Hub de Minecraft ─── */}
        <div className="flex items-center justify-center">
          <div className="inline-flex p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border-2 border-[#E8DFC5] bg-white shadow-[0_4px_16px_rgba(76,59,18,0.06)] flex-wrap items-center justify-center gap-1 sm:gap-2">
            {[
              { id: 'server' as const, label: 'Estado & Jugadores', icon: Server },
              { id: 'tops' as const, label: 'Tops & Récords', icon: Trophy },
              { id: 'locations' as const, label: 'Coordenadas', icon: Compass },
              { id: 'guides' as const, label: 'Comandos & Guías', icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl font-display text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#FFD500] text-black shadow-[3px_3px_0_#D4A000] -translate-y-0.5'
                      : 'text-[#64748B] hover:text-[#2D3139] hover:bg-[#FDFBF7]'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── TAB 1: ESTADO EN VIVO DEL SERVIDOR & JUGADORES (2 COLUMNAS) ─── */}
        {activeTab === 'server' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Centered Header */}
            <div className="text-center space-y-2">
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-[#2D3139] flex items-center justify-center gap-2">
                🎮 Estado del Servidor & Jugadores
              </h2>
              <p className="font-sans text-xs sm:text-sm text-gray-500 font-bold max-w-xl mx-auto">
                Consulta los datos de conexión, estado en vivo y miembros activos en el mundo compartido
              </p>
            </div>

            {/* 2-Column Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Columna Izquierda: Conexión + Tu Estado en el Servidor */}
              <div className="space-y-4">
                <MinecraftInGameCard />

                {session && (
                  <div className="bg-[#141517] border-2 border-neutral-700/90 rounded-2xl p-5 shadow-2xl space-y-3.5 text-white font-sans">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-xs uppercase tracking-wider text-gray-300">
                          Tu Cuenta en el Servidor
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${userRankInfo.color}`}>
                        <Crown className="w-3 h-3" /> {userRankInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-lg text-white">
                          {profile?.roblox_display_name || 'Pollito'}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {userRankInfo.perks}
                        </p>
                      </div>

                      <Link
                        href="/minecraft/link"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFD500] text-black text-xs font-black shadow-xs hover:bg-[#F2C800] transition cursor-pointer shrink-0"
                      >
                        ⚙️ Cuentas <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Columna Derecha: Lista de Jugadores Conectados en Tiempo Real */}
              <div className="bg-white rounded-2xl border-2 border-[#E8DFC5] p-5 sm:p-6 shadow-sm space-y-4 min-h-[300px]">
                <div className="flex items-center justify-between border-b border-[#E8DFC5] pb-3">
                  <div>
                    <h3 className="font-display font-black text-base text-[#2D3139] flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                      Jugadores Conectados ({players.length} / {status?.maxPlayers || 20})
                    </h3>
                    <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                      {online ? 'Servidor activo · Sincronizado en tiempo real' : 'Servidor en espera'}
                    </p>
                  </div>

                  <span className="text-xs font-mono font-bold text-gray-400 bg-[#FDFBF7] px-2.5 py-1 rounded-lg border border-gray-200">
                    TPS: {status?.tps ? status.tps.toFixed(1) : '20.0'}
                  </span>
                </div>

                {players.length === 0 ? (
                  <div className="py-12 text-center bg-[#FDFBF7] rounded-2xl border border-dashed border-gray-200 p-6">
                    <p className="text-xs font-bold text-[#64748B]">No hay jugadores conectados en este momento.</p>
                    <p className="text-[11px] text-gray-400 mt-1">¡Sé el primero en entrar a construir!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {players.map((p, idx) => (
                      <PlayerCard key={idx} player={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: TOPS & RÉCORDS (2 COLUMNAS) ─── */}
        {activeTab === 'tops' && (
          <div className="animate-fadeIn">
            <MinecraftTopsSection />
          </div>
        )}

        {/* ─── TAB 3: COORDENADAS & PUNTOS CLAVE (DARK GAMER HUD THEME) ─── */}
        {activeTab === 'locations' && (
          <section id="coordenadas" className="space-y-6 animate-fadeIn">
            {/* Centered Header */}
            <div className="text-center space-y-2">
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-[#2D3139] flex items-center justify-center gap-2">
                📍 Coordenadas & Monumentos Oficiales
              </h2>
              <p className="font-sans text-xs sm:text-sm text-gray-500 font-bold max-w-xl mx-auto">
                Puntos de interés públicos del servidor para orientarte y explorar en grupo
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {locations.map((loc) => {
                const isCopied = copiedLocation === loc.id;
                return (
                  <div
                    key={loc.id}
                    className="bg-[#141517] rounded-3xl border-2 border-neutral-800 p-5 sm:p-6 shadow-2xl flex flex-col justify-between space-y-5 hover:border-neutral-700 transition text-white"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl drop-shadow-md">{loc.emoji}</span>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border tracking-wide ${
                          loc.dimension === 'nether'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                            : loc.dimension === 'end'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                        }`}>
                          {loc.dimension === 'overworld' ? '🌍 Overworld' : loc.dimension === 'nether' ? '🌋 Nether' : '🐉 The End'}
                        </span>
                      </div>
                      <h3 className="font-display font-black text-lg text-white">{loc.name}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed font-medium">{loc.description}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                        Coordenadas
                      </label>
                      <div className="flex items-center justify-between gap-2 bg-[#0d0e10] border border-neutral-800 rounded-xl p-1.5 pl-3">
                        <code className="text-xs font-mono font-black text-[#FFD500] tracking-wide">
                          X: {loc.x} · Y: {loc.y || 64} · Z: {loc.z}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCoordinates(loc)}
                          className={
                            isCopied
                              ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shrink-0 bg-emerald-600 text-white shadow-xs'
                              : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shrink-0 bg-[#FFD500] hover:bg-[#F2C800] text-black shadow-xs'
                          }
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {isCopied ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl border-2 border-dashed border-neutral-800 bg-[#141517] p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl">🏘️</span>
                <div>
                  <h4 className="font-display font-black text-sm text-white">¿Tienes un pueblo, tienda o base comunitaria?</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Pide a un Administrador registrar tus coordenadas para que figure en el mapa oficial del Team Pollito.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── TAB 4: GUÍAS & COMANDOS (DARK GAMER HUD CON BOTÓN DE COPIAR) ─── */}
        {activeTab === 'guides' && (
          <section className="space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-[#2D3139] flex items-center justify-center gap-2">
                📖 Comandos & Guía de Supervivencia
              </h2>
              <p className="font-sans text-xs sm:text-sm text-gray-500 font-bold max-w-xl mx-auto">
                Haz clic en cualquier comando para copiarlo a tu portapapeles y pegarlo en el chat del juego
              </p>
            </div>

            <div className="rounded-3xl border-2 border-neutral-800 bg-[#141517] p-6 sm:p-8 shadow-2xl space-y-6 text-white">
              <div className="border-b border-neutral-800 pb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-black text-xl sm:text-2xl text-white flex items-center gap-2">
                    📜 Comandos Esenciales de Supervivencia
                  </h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    Usa estos comandos en el chat (<kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-[#FFD500] font-mono text-[10px]">T</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-[#FFD500] font-mono text-[10px]">Ctrl+V</kbd>) para moverte y proteger tus construcciones.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { cmd: '/spawn', label: 'Spawn Seguro', desc: 'Regresa al punto inicial seguro y protegido del servidor.' },
                  { cmd: '/sethome casa', label: 'Guardar Casa', desc: 'Guarda la ubicación exacta de tu casa o base actual.' },
                  { cmd: '/home casa', label: 'Volver a Casa', desc: 'Teletranspórtate a tu casa guardada al instante.' },
                  { cmd: '/tpa ', label: 'Teletransporte', desc: 'Envía una solicitud de teletransporte a otro pollito.' },
                  { cmd: '/tpaccept', label: 'Aceptar TPA', desc: 'Acepta la solicitud de teletransporte de un amigo.' },
                  { cmd: '/trust ', label: 'Permisos de Terreno', desc: 'Da permisos de construcción a un amigo en tu terreno protegido.' },
                ].map((c) => {
                  const isCopied = copiedCommand === c.cmd;
                  return (
                    <div
                      key={c.cmd}
                      className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/90 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black text-gray-300 uppercase tracking-wider font-display">
                            {c.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-medium mt-1 leading-relaxed">
                          {c.desc}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-[#0d0e10] border border-neutral-800 rounded-xl p-1.5 pl-3">
                        <code className="text-xs font-mono font-black text-[#FFD500]">
                          {c.cmd}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCommandText(c.cmd)}
                          className={
                            isCopied
                              ? 'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shrink-0 bg-emerald-600 text-white shadow-xs'
                              : 'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shrink-0 bg-[#FFD500] hover:bg-[#F2C800] text-black shadow-xs'
                          }
                        >
                          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {isCopied ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
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
    <article className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-[#FFFDF5] p-2.5 shadow-2xs hover:border-[#FFD500] transition">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FFDFA0] border border-[#FFD500]/50">
        {player.avatarUrl ? (
          <Image src={player.avatarUrl} alt="" fill sizes="36px" unoptimized className="h-full w-full object-cover" />
        ) : (
          <span className="text-base" aria-hidden>🐣</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-[#2D3139]">{displayName}</p>
        <p className="truncate text-[10px] font-semibold text-[#8B6B00]">{connections || 'Minecraft'}</p>
      </div>
    </article>
  );
}