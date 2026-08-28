'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Crown, Loader2, Medal, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTikTokRankings } from './useTikTokRankings';
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
    <div className={`${large ? 'h-11 w-11' : 'h-8 w-8'} flex shrink-0 items-center justify-center overflow-hidden rounded-full border ${entry.profile ? 'border-[#FFC200]' : 'border-neutral-700'} bg-[#35373d]`}>
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={`Avatar de @${entry.display_id}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={large ? 'text-lg' : 'text-sm'}>♪</span>
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
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
      <p className="font-display text-sm text-[#2D3139]">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{detail}</p>
    </div>
  );
}

function StatusState({ state }: { state: RankingsState }) {
  if (state.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-xs font-bold uppercase tracking-wide text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-[#FFC200]" />
        Cargando ranking...
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
  return (
    <div className={dark ? 'space-y-2' : 'space-y-3'}>
      {entries.slice(0, limit).map((entry) => {
        const winner = entry.position === 1;
        const linked = Boolean(entry.profile);
        const rowClass = dark
          ? linked ? 'border-[#FFC200]/35 bg-[#FFC200]/5' : 'border-neutral-700/40 bg-[#2b2d31]'
          : linked ? 'border-[#FFC200]/35 bg-[#FFF9E6]' : 'border-gray-100 bg-white';

        return (
          <div key={`${entry.display_id}-${entry.position}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${rowClass}`}>
            <span className={`w-6 text-center font-black ${winner ? `text-lg ${dark ? 'text-[#D4A000]' : 'text-[#D4A000]'}` : `text-xs ${dark ? 'text-gray-400' : 'text-gray-400'}`}`}>
              {winner ? <Crown className="mx-auto h-4 w-4" /> : entry.position}
            </span>
            <Avatar entry={entry} large={winner} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className={`truncate text-xs font-bold ${dark ? 'text-white' : 'text-[#2D3139]'}`}>{entry.nickname || `@${entry.display_id}`}</p>
                {linked && <span className="shrink-0 rounded-full bg-[#FFC200]/15 px-2 py-0.5 text-[8px] font-black uppercase text-[#D4A000]">Miembro</span>}
              </div>
              {linked && <p className="truncate text-[10px] text-gray-500">Perfil vinculado: @{entry.profile?.roblox_user}</p>}
            </div>
            <span className={`shrink-0 text-xs font-bold font-mono ${dark ? 'text-gray-300' : 'text-[#2D3139]'}`}>{formatValue(entry.value, metric)}</span>
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
  const selectClass = dark ? 'border border-neutral-700 bg-[#20232a] text-white' : 'border border-gray-200 bg-white text-[#2D3139]';
  const focusClass = 'focus:border-[#FFC200]';
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label="Métrica de clasificación" value={metric} onChange={(event) => onMetric(event.target.value as RankingMetric)} className={`rounded-xl px-3 py-2 text-xs font-bold outline-none ${focusClass} ${selectClass}`}>
        {RANKING_METRICS.map((item) => <option key={item} value={item}>{METRIC_LABELS[item]}</option>)}
      </select>
      <select aria-label="Período de clasificación" value={period} onChange={(event) => onPeriod(event.target.value as RankingPeriod)} className={`rounded-xl px-3 py-2 text-xs font-bold outline-none ${focusClass} ${selectClass}`}>
        {RANKING_PERIODS.map((item) => <option key={item} value={item}>{PERIOD_LABELS[item]}</option>)}
      </select>
    </div>
  );
}

function findSet(data: RankingsState['data'], metric: RankingMetric, period: RankingPeriod) {
  return data?.sets.find((item) => item.metric === metric && item.period === period);
}

type RankingSnapshotOption = { id: string; captured_at: string };

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
  const [snapshots, setSnapshots] = useState<RankingSnapshotOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    void fetch('/api/tiktok/rankings/snapshots?limit=100', { headers })
      .then((response) => response.json() as Promise<{ snapshots?: RankingSnapshotOption[] }>)
      .then((body) => {
        if (cancelled) return;
        const next = body.snapshots ?? [];
        setSnapshots(next);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      });
    return () => { cancelled = true; };
  }, [accessToken]);

  const selectClass = dark
    ? 'border border-neutral-700 bg-[#20232a] text-white'
    : 'border border-gray-200 bg-white text-[#2D3139]';

  return (
    <div className="flex items-center gap-1.5">
      <CalendarDays className="h-4 w-4 text-[#D4A000] shrink-0" />
      <select
        aria-label="Seleccionar fecha de snapshot"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? event.target.value : null)}
        className={`rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#FFC200] transition-colors cursor-pointer ${selectClass}`}
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

export function TikTokRankingLanding({ accessToken = null }: { accessToken?: string | null }) {
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const state = useTikTokRankings(accessToken, 10, accessToken ? snapshotId : null);
  const [metric, setMetric] = useState<RankingMetric>('viewers');
  const [period, setPeriod] = useState<RankingPeriod>('last_live');
  const selected = findSet(state.data, metric, period);

  return (
    <section id="rankings" className="space-y-5 pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#D4A000]" />
            <h3 className="font-display text-2xl font-bold tracking-tight text-[#2D3139]">Top 10 de TikTok LIVE</h3>
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-500">Resumen del Snapshot de Ranking publicado; los Miembros Oficiales aparecen destacados.</p>
        </div>
        <Link href={buildPublicRankingHref({ metric, period })} className="inline-flex items-center gap-1 text-xs font-bold text-[#D4A000] hover:text-[#2D3139]">
          Ver clasificaciones completas <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {state.loading || state.error || !state.data?.batch_id ? (
        <StatusState state={state} />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,.06)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <p className="font-display text-xs font-bold uppercase text-[#2D3139]">{METRIC_LABELS[metric]} · {PERIOD_LABELS[period]}</p>
              <p className="mt-1 text-[10px] text-gray-400">Actualizado {formatDate(state.data.captured_at)} · Ventana: {formatWindow(selected)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SnapshotCalendar accessToken={accessToken} value={snapshotId} onChange={setSnapshotId} />
              <RankingControls metric={metric} period={period} onMetric={setMetric} onPeriod={setPeriod} />
            </div>
          </div>
          {!selected || selected.entries.length === 0
            ? <EmptyState title="Sin actividad para este período" detail="TikTok no devolvió participantes para esta combinación." />
            : (
              <>
                {selected.entries.length >= 3 && (
                  <TopThreePodium viewers={selected.entries.slice(0, 3)} metric={metric} />
                )}
                <RankingRows
                  entries={selected.entries.length >= 3 ? selected.entries.slice(3) : selected.entries}
                  limit={7}
                  metric={metric}
                />
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
  const [period, setPeriod] = useState<RankingPeriod>('last_live');
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
            <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Capturado {formatDate(state.data.captured_at)}</span>
              <span>Ventana {formatWindow(selected)}</span>
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

  const navigateToFilters = (nextMetric: RankingMetric, nextPeriod: RankingPeriod) => {
    if (nextMetric === metric && nextPeriod === period) return;

    router.push(buildPublicRankingHref({ metric: nextMetric, period: nextPeriod }), {
      scroll: false,
    });
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-10 font-sans text-black sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-[#2D3139]">Clasificaciones de TikTok LIVE</h1>
              <p className="mt-2 text-sm text-gray-500">Consulta las clasificaciones completas por fecha, métrica y período.</p>
            </div>
            <Link href="/" className="inline-flex items-center gap-1 rounded-xl bg-[#FFD500] px-4 py-2 text-xs font-bold text-[#2D3139] transition hover:bg-[#FFC200]">
              Volver a la comunidad <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,.06)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <p className="font-display text-xs font-bold uppercase text-[#2D3139]">{METRIC_LABELS[metric]} · {PERIOD_LABELS[period]}</p>
              <p className="mt-1 text-[10px] text-gray-400">
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
            </div>
          </div>

          {state.loading || state.error || !state.data?.batch_id ? (
            <StatusState state={state} />
          ) : !selected || selected.entries.length === 0 ? (
            <EmptyState title="Sin actividad en este período" detail="TikTok no devolvió participantes para esta combinación." />
          ) : (
            <RankingRows entries={selected.entries} metric={metric} />
          )}
        </section>
      </div>
    </main>
  );
}
