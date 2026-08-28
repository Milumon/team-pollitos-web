'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Copy, Crown, Flame, Loader2, Medal, Share2, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTikTokRankings } from './useTikTokRankings';
import type { Session } from '@supabase/supabase-js';
import { Header } from '@/components/ui/Header';
import { NavBar } from '@/components/ui/NavBar';
import { supabase } from '@/lib/supabaseClient';
import { TopThreePodium } from './TopThreePodium';
import { buildPublicRankingHref, parsePublicRankingFilters } from '@/lib/publicRankingRoute';
import { MAX_RANKING_ENTRIES_PER_SNAPSHOT } from '@/lib/tiktokRankingLimits';
import {
  METRIC_LABELS,
  PERIOD_LABELS,
  RANKING_METRICS,
  RANKING_PERIODS,
  type RankingEntry,
  type RankingMetric,
  type RankingPeriod,
  type RankingSet,
  type RankingsState,
} from './types';

export function formatValue(value: string, metric?: RankingMetric) {
  try {
    if (metric === 'viewers') {
      const totalMinutes = BigInt(value) / BigInt(60_000);
      const hours = totalMinutes / BigInt(60);
      const minutes = totalMinutes % BigInt(60);
      if (hours > BigInt(0)) return `${hours} h ${minutes} min`;
      return `${minutes} min`;
    }
    return BigInt(value).toLocaleString('es-ES');
  } catch {
    return value;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatWindow(set: RankingSet | undefined) {
  if (!set) return '';
  if (!set.window.begin || !set.window.end) return 'No informada por TikTok';
  return `${formatDate(set.window.begin)} - ${formatDate(set.window.end)}`;
}

function tiktokAvatarUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  return `/api/tiktok/avatar?uri=${encodeURIComponent(uri)}`;
}

function Avatar({
  entry,
  large = false,
}: {
  entry: RankingEntry;
  large?: boolean;
}) {
  const robloxUrl = entry.profile?.roblox_avatar_url;
  const tiktokUrl = tiktokAvatarUrl(entry.tiktok_avatar_uri);
  const imgSrc = robloxUrl || tiktokUrl;

  return (
    <div className={`${large ? 'h-11 w-11' : 'h-9 w-9'} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${entry.profile ? 'border-[#FFD500] ring-2 ring-yellow-400/20' : 'border-neutral-200'} bg-[#FFF7DC]`}>
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          style={robloxUrl ? { transform: 'scale(1.4) translateY(-5%)' } : undefined}
        />
      ) : (
        <span className="text-sm">🐣</span>
      )}
    </div>
  );
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-12 text-center">
      <Trophy className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-50" />
      <p className="font-display font-bold text-sm text-[#2D3139]">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

function StatusState({ state }: { state: RankingsState }) {
  if (state.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold uppercase tracking-widest text-[#9A8D70]">
        <Loader2 className="h-5 w-5 animate-spin text-[#FFD500]" />
        Cargando clasificaciones de TikTok...
      </div>
    );
  }
  if (state.error) {
    return (
      <EmptyState
        title="No se pudo cargar el ranking"
        detail="Vuelve a intentarlo en unos segundos."
      />
    );
  }
  if (!state.data?.batch_id || state.data.sets.length === 0) {
    return (
      <EmptyState
        title="Aún no hay snapshot publicado"
        detail="El ranking aparecerá después de la próxima importación."
      />
    );
  }
  return null;
}

function RankingRows({
  entries,
  dark = false,
  limit,
  metric,
}: {
  entries: RankingEntry[];
  dark?: boolean;
  limit?: number;
  metric?: RankingMetric;
}) {
  const visible = entries.slice(0, limit);

  return (
    <div className="space-y-2.5">
      {visible.map((entry) => {
        const isTopTen = entry.position <= 10;
        const linked = Boolean(entry.profile);

        return (
          <div
            key={`${entry.display_id}-${entry.position}`}
            className={`flex items-center justify-between gap-3 rounded-2xl border p-3 sm:px-4 sm:py-3 transition-all hover:shadow-xs ${
              dark
                ? linked
                  ? 'border-[#FFD500]/30 bg-[#FFD500]/5'
                  : 'border-neutral-800 bg-neutral-900/60'
                : isTopTen
                ? 'border-[#FFE799] bg-linear-to-r from-[#FFFDF5] to-[#FFFBEA]'
                : 'border-neutral-100 bg-white hover:border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Rank Badge */}
              <div
                className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black ${
                  isTopTen
                    ? 'bg-[#FFD500] text-black shadow-xs'
                    : dark
                    ? 'bg-neutral-800 text-neutral-400'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {entry.position}
              </div>

              {/* Avatar */}
              <Avatar entry={entry} />

              {/* Names */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`truncate text-xs sm:text-sm font-black ${dark ? 'text-white' : 'text-[#2D3139]'}`}>
                    {entry.nickname || `@${entry.display_id}`}
                  </p>
                  {linked && (
                    <span className="shrink-0 rounded-full bg-[#FFD500]/20 px-2 py-0.2 text-[8px] font-black uppercase text-[#8B6B00]">
                      Miembro
                    </span>
                  )}
                </div>
                <p className="truncate text-[10px] text-neutral-400">
                  {linked ? `Perfil vinculado: @${entry.profile?.roblox_user}` : `@${entry.display_id}`}
                </p>
              </div>
            </div>

            {/* Value Pill */}
            <div className="shrink-0">
              <span className={`inline-block px-3 py-1 rounded-xl text-xs font-mono font-black ${
                dark
                  ? 'bg-neutral-800 text-yellow-400'
                  : 'bg-neutral-100 text-[#2D3139] border border-neutral-200/60'
              }`}>
                {formatValue(entry.value, metric)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankingControls({
  metric,
  period,
  onMetric,
  onPeriod,
  dark = false,
}: {
  metric: RankingMetric;
  period: RankingPeriod;
  onMetric: (value: RankingMetric) => void;
  onPeriod: (value: RankingPeriod) => void;
  dark?: boolean;
}) {
  const metricOptions: { value: RankingMetric; label: string; icon: string }[] = [
    { value: 'viewers', label: 'Espectadores', icon: '⏱️' },
    { value: 'gifts', label: 'Regalos', icon: '🎁' },
  ];

  const periodOptions: { value: RankingPeriod; label: string; icon: string }[] = [
    { value: 'last_live', label: 'Último Live', icon: '🔴' },
    { value: '7_days', label: '7 Días', icon: '⚡' },
    { value: '28_days', label: '28 Días', icon: '🏆' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Metric Segmented */}
      <div className={`inline-flex p-1 rounded-xl border ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'}`}>
        {metricOptions.map((opt) => {
          const isActive = metric === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onMetric(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isActive
                  ? 'bg-[#FFD500] text-black shadow-xs'
                  : dark
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              <span>{opt.icon}</span> {opt.label}
            </button>
          );
        })}
      </div>

      {/* Period Segmented */}
      <div className={`inline-flex p-1 rounded-xl border ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'}`}>
        {periodOptions.map((opt) => {
          const isActive = period === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isActive
                  ? 'bg-[#FFD500] text-black shadow-xs'
                  : dark
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              <span>{opt.icon}</span> {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function findSet(data: RankingsState['data'], metric: RankingMetric, period: RankingPeriod) {
  return data?.sets.find((item) => item.metric === metric && item.period === period);
}

type RankingSnapshotOption = { id: string; captured_at: string };

let globalSnapshotsCache: RankingSnapshotOption[] | null = null;

export function SnapshotCalendar({
  accessToken = null,
  value,
  onChange,
  dark = false,
}: {
  accessToken?: string | null;
  value: string | null;
  onChange: (batchId: string | null) => void;
  dark?: boolean;
}) {
  const [snapshots, setSnapshots] = useState<RankingSnapshotOption[]>(() => globalSnapshotsCache || []);

  useEffect(() => {
    let cancelled = false;
    const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    void fetch('/api/tiktok/rankings/snapshots?limit=100', { headers })
      .then((response) => response.json() as Promise<{ snapshots?: RankingSnapshotOption[] }>)
      .then((body) => {
        if (cancelled) return;
        const next = body.snapshots ?? [];
        globalSnapshotsCache = next; setSnapshots(next);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      });
    return () => { cancelled = true; };
  }, [accessToken]);

  const selectClass = dark
    ? 'border-neutral-800 bg-neutral-900 text-white'
    : 'border-neutral-200 bg-white text-[#2D3139]';

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Seleccionar fecha de snapshot"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? event.target.value : null)}
        className={`rounded-xl px-3 py-1.5 text-xs font-bold border outline-none focus:border-[#FFD500] transition-colors cursor-pointer ${selectClass}`}
      >
        <option value="">📅 Más reciente (Publicado)</option>
        {snapshots.map((snap) => (
          <option key={snap.id} value={snap.id}>
            {formatDate(snap.captured_at)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ShareRankingButton({
  selected,
  metric,
  period,
}: {
  selected?: RankingSet;
  metric: RankingMetric;
  period: RankingPeriod;
}) {
  const [copied, setCopied] = useState(false);

  const copySummary = () => {
    if (!selected || selected.entries.length === 0) return;
    const top10 = selected.entries.slice(0, 10);
    const metricTitle = metric === 'viewers' ? '⏱️ ESPECTADORES TOP' : '💎 DIAMANTES TOP';
    const periodTitle = period === 'last_live' ? '🔴 Último Live' : period === '7_days' ? '⚡ 7 Días' : '🏆 28 Días';
    
    let text = `👑 CLASIFICACIONES TEAM POLLITO 👑\n${metricTitle} · ${periodTitle}\n\n`;
    top10.forEach((e) => {
      const medal = e.position === 1 ? '🥇' : e.position === 2 ? '🥈' : e.position === 3 ? '🥉' : `#${e.position}`;
      const name = e.nickname || `@${e.display_id}`;
      const val = formatValue(e.value, metric);
      text += `${medal} ${name}: ${val}\n`;
    });
    text += `\n🌐 Consulta el ranking en: https://teampollito.milumon.dev/clasificaciones`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <button
      type="button"
      onClick={copySummary}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
        copied
          ? 'bg-emerald-600 text-white'
          : 'bg-[#FFD500] hover:bg-[#F2C800] text-black shadow-xs'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
      {copied ? '¡Copiado para Redes!' : 'Compartir Top'}
    </button>
  );
}

export function TikTokRankingLanding({ accessToken = null }: { accessToken?: string | null }) {
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const state = useTikTokRankings(accessToken, 10, accessToken ? snapshotId : null);
  const [metric, setMetric] = useState<RankingMetric>('viewers');
  const [period, setPeriod] = useState<RankingPeriod>('7_days');
  const selected = findSet(state.data, metric, period);

  return (
    <section id="rankings" className="space-y-6 pt-8">
      {/* Header Centrado idéntico a las secciones principales */}
      <div className="text-center space-y-2">
        <h3 className="font-display font-bold text-3xl tracking-tight leading-none text-[#2D3139]">
          Top Campeones de TikTok LIVE 🏆
        </h3>
        <p className="font-sans text-xs text-gray-500 font-bold">
          Los miembros más destacados en tiempo de visualización y apoyo durante los directos.
        </p>
        <div className="pt-1">
          <Link
            href={buildPublicRankingHref({ metric, period })}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#D4A000] hover:text-[#2D3139] hover:underline"
          >
            Ver clasificaciones completas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {state.loading || state.error || !state.data?.batch_id ? (
        <StatusState state={state} />
      ) : (
        <div className="rounded-3xl border border-[#E8DFC5] bg-white p-5 sm:p-8 shadow-[0_8px_24px_rgba(76,59,18,0.06)] space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8DFC5] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9A8D70]">
                {METRIC_LABELS[metric]} · {PERIOD_LABELS[period]}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Ventana: {formatWindow(selected)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SnapshotCalendar accessToken={accessToken} value={snapshotId} onChange={setSnapshotId} />
              <RankingControls metric={metric} period={period} onMetric={setMetric} onPeriod={setPeriod} />
              <ShareRankingButton selected={selected} metric={metric} period={period} />
            </div>
          </div>

          {!selected || selected.entries.length === 0 ? (
            <EmptyState title="Sin actividad para este período" detail="TikTok no devolvió participantes para esta combinación." />
          ) : (
            <>
              {/* Podio Top 3 */}
              {selected.entries.length >= 3 && (
                <TopThreePodium viewers={selected.entries.slice(0, 3)} metric={metric} />
              )}

              {/* Filas 4 al 10 */}
              <div className="pt-2">
                <h4 className="font-display font-black text-sm text-[#2D3139] mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#D4A000]" /> Tabla de Clasificación
                </h4>
                <RankingRows
                  entries={selected.entries.length >= 3 ? selected.entries.slice(3) : selected.entries}
                  limit={7}
                  metric={metric}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function TikTokRankingConsole({ accessToken }: { accessToken: string }) {
  const state = useTikTokRankings(accessToken);
  const [metric, setMetric] = useState<RankingMetric>('viewers');
  const [period, setPeriod] = useState<RankingPeriod>('7_days');
  const selected = findSet(state.data, metric, period);
  const me = selected?.me ?? null;
  const meIsVisible = me ? selected?.entries.some((entry) => entry.position === me.position && entry.display_id === me.display_id) : false;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 text-left scrollbar-thin">
      <div className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
        <div className="mb-4 flex flex-col gap-3 border-b border-neutral-700/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#FFC200]" />
            <div>
              <h2 className="font-display text-lg font-bold text-white">Rankings de TikTok LIVE</h2>
              <p className="mt-1 text-[10px] font-semibold text-gray-500">Ranking completo con Miembros Oficiales destacados</p>
            </div>
          </div>
          <RankingControls metric={metric} period={period} onMetric={setMetric} onPeriod={setPeriod} dark />
        </div>

        {state.loading || state.error || !state.data?.batch_id ? (
          <StatusState state={state} />
        ) : !selected ? (
          <EmptyState title="Combinación no disponible" detail="El snapshot actual no contiene este período." />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Capturado {formatDate(state.data.captured_at)}</span>
              <span>Ventana: {formatWindow(selected)}</span>
            </div>
            {selected.entries.length === 0
              ? <EmptyState title="Sin actividad" detail="No hay actividad en esta combinación." />
              : <RankingRows entries={selected.entries} dark metric={metric} />}

            <div className={`mt-5 rounded-xl border p-4 ${me ? meIsVisible ? 'border-[#FFC200]/40 bg-[#FFC200]/10' : 'border-sky-500/30 bg-sky-500/10' : 'border-neutral-700 bg-[#24262b]'}`}>
              <div className="flex items-center gap-3">
                {me ? <Avatar entry={me} large /> : <Medal className="h-7 w-7 text-gray-500" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Tu posición</p>
                  {me ? (
                    <p className="truncate font-display text-sm font-bold text-white">#{me.position} · {me.nickname || `@${me.display_id}`} · {formatValue(me.value, metric)}</p>
                  ) : (
                    <p className="text-xs font-semibold text-gray-400">Sin actividad vinculada en esta combinación.</p>
                  )}
                  {me && !meIsVisible && <p className="mt-1 text-[10px] text-sky-300">Tu posición está fuera del tramo visible.</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function TikTokRankingPublicPage() {
  const searchParams = useSearchParams();
  const [snapshotId, setSnapshotId] = useState<string | null>(searchParams?.get('snapshot') || null);
  const state = useTikTokRankings(null, MAX_RANKING_ENTRIES_PER_SNAPSHOT, snapshotId);
  const router = useRouter();
  const { metric, period } = parsePublicRankingFilters({
    metrica: searchParams?.get('metrica'),
    periodo: searchParams?.get('periodo'),
  });
  const selected = findSet(state.data, metric, period);

  const [session, setSession] = useState<Session | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const logout = async () => { await supabase.auth.signOut(); };

  const navigateToFilters = (nextMetric: RankingMetric, nextPeriod: RankingPeriod) => {
    if (nextMetric === metric && nextPeriod === period) return;

    router.push(buildPublicRankingHref({ metric: nextMetric, period: nextPeriod }), {
      scroll: false,
    });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D3139] selection:bg-[#FFB000] selection:text-black">
      <Header
        session={session}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogin={() => window.location.assign('/acceso?returnTo=/clasificaciones')}
      />
      <NavBar
        variant="drawer"
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        session={session}
        onLogout={logout}
        onLogin={() => window.location.assign('/acceso?returnTo=/clasificaciones')}
      />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        {/* Header Title */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-display text-xs font-bold uppercase tracking-[0.25em] text-[#D4A000]">
              TikTok LIVE · Team Pollito
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#2D3139]">
              Clasificaciones <span className="text-[#D4A000]">Oficiales</span>
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#64748B]">
              Padrón oficial de espectadores, tiempo de visualización y apoyo durante los directos de Milumon.
            </p>
          </div>


        </div>

        <section className="rounded-3xl border-2 border-[#E8DFC5] bg-white p-5 sm:p-8 shadow-[0_8px_30px_rgba(76,59,18,0.06)] space-y-6">
          {/* Controls Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8DFC5] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9A8D70]">
                {METRIC_LABELS[metric]} · {PERIOD_LABELS[period]}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Capturado {formatDate(state.data?.captured_at)} · Ventana: {formatWindow(selected)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SnapshotCalendar value={snapshotId} onChange={setSnapshotId} />
              <RankingControls
                metric={metric}
                period={period}
                onMetric={(nextMetric) => navigateToFilters(nextMetric, period)}
                onPeriod={(nextPeriod) => navigateToFilters(metric, nextPeriod)}
              />
              <ShareRankingButton selected={selected} metric={metric} period={period} />
            </div>
          </div>

          {state.loading || state.error || !state.data?.batch_id ? (
            <StatusState state={state} />
          ) : !selected || selected.entries.length === 0 ? (
            <EmptyState title="Sin actividad en este período" detail="TikTok no devolvió participantes para esta combinación." />
          ) : (
            <>
              {/* Podio 3D Top 3 */}
              {selected.entries.length >= 3 && (
                <TopThreePodium viewers={selected.entries.slice(0, 3)} metric={metric} />
              )}

              {/* Tabla de Clasificación */}
              <div className="pt-2 space-y-3">
                <h3 className="font-display font-black text-sm text-[#2D3139] uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#D4A000]" /> Tabla de Clasificación Completa
                </h3>
                <RankingRows
                  entries={selected.entries.length >= 3 ? selected.entries.slice(3) : selected.entries}
                  metric={metric}
                />
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}