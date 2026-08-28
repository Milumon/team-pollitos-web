'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Unlink,
  Sparkles,
  ChevronDown,
  ChevronUp,
  History,
  ShieldCheck,
  Trophy,
  Users,
  Radio,
  ExternalLink,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { adminFetch, readApiPayload } from './adminApi';

export type TikTokIdentityReview = {
  tiktok_id: string;
  display_id: string;
  nickname: string;
  ranking_entry_count: number;
  status: 'unlinked' | 'ambiguous' | 'linked';
  linked_profile_id: string | null;
  candidate_count: number;
  candidates: { id: string; name: string; roblox_user: string | null }[];
};

export type TikTokImportAttempt = {
  id: string;
  status: 'validation_failed' | 'publish_failed' | 'published' | 'replayed';
  idempotency_key: string | null;
  captured_at: string | null;
  sets_received: number;
  sets_validated: number;
  batch_id: string | null;
  error_message: string | null;
  created_at: string;
};

export type TikTokAdminOperations = {
  history: { batch_id: string; captured_at: string; activations: { activated_at: string; reason: string | null }[] }[];
  active_batch: { batch_id: string; captured_at: string; activated_at: string } | null;
  latest_import: TikTokImportAttempt | null;
  import_attempts: TikTokImportAttempt[];
  identities: TikTokIdentityReview[];
  import_token_configured: boolean;
};

interface MemberOption {
  id: string;
  email: string;
  robloxUser?: string | null;
  robloxDisplayName?: string | null;
  robloxAvatarUrl?: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function TikTokOperationsView() {
  const [identities, setIdentities] = useState<TikTokIdentityReview[]>([]);
  const [operations, setOperations] = useState<TikTokAdminOperations | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'linked' | 'unlinked' | 'all'>('linked');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load All Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [identitiesRes, opsRes, statsRes] = await Promise.all([
        adminFetch('/api/admin/tiktok/identities?limit=500'),
        adminFetch('/api/admin/tiktok/rankings'),
        adminFetch('/api/admin/stats'),
      ]);

      const [identitiesData, opsData, statsData] = await Promise.all([
        readApiPayload(identitiesRes),
        readApiPayload(opsRes),
        readApiPayload(statsRes),
      ]);

      if (identitiesData?.identities) {
        setIdentities(identitiesData.identities as TikTokIdentityReview[]);
      }
      if (opsData) {
        setOperations(opsData as TikTokAdminOperations);
      }
      if (statsData?.users) {
        const approved = (statsData.users as Array<{ id: string; email: string; linkStatus: string; robloxUser?: string; robloxDisplayName?: string; robloxAvatarUrl?: string }>)
          .filter((u) => u.linkStatus === 'approved')
          .map((u) => ({
            id: u.id,
            email: u.email,
            robloxUser: u.robloxUser,
            robloxDisplayName: u.robloxDisplayName,
            robloxAvatarUrl: u.robloxAvatarUrl,
          }));
        setMembers(approved);
      }
    } catch (err) {
      console.error('[TikTokOperationsView error]:', err);
      setActionError(err instanceof Error ? err.message : 'Error al cargar operaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Member Lookup Map
  const memberMap = useMemo(() => {
    const map = new Map<string, MemberOption>();
    for (const m of members) {
      map.set(m.id, m);
    }
    return map;
  }, [members]);

  // Counts
  const counts = useMemo(() => {
    const total = identities.length;
    const linked = identities.filter((i) => i.status === 'linked' || Boolean(i.linked_profile_id)).length;
    const unlinked = total - linked;
    return { total, linked, unlinked };
  }, [identities]);

  // Filter & Search
  const filteredIdentities = useMemo(() => {
    let result = identities;
    if (activeTab === 'linked') {
      result = result.filter((i) => i.status === 'linked' || Boolean(i.linked_profile_id));
    } else if (activeTab === 'unlinked') {
      result = result.filter((i) => i.status !== 'linked' && !i.linked_profile_id);
    }

    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return result;

    return result.filter((i) => {
      const linked = i.linked_profile_id ? memberMap.get(i.linked_profile_id) : null;
      return (
        i.display_id.toLowerCase().includes(needle) ||
        (i.nickname && i.nickname.toLowerCase().includes(needle)) ||
        (linked?.robloxUser && linked.robloxUser.toLowerCase().includes(needle)) ||
        (linked?.robloxDisplayName && linked.robloxDisplayName.toLowerCase().includes(needle)) ||
        (linked?.email && linked.email.toLowerCase().includes(needle))
      );
    });
  }, [identities, activeTab, searchTerm, memberMap]);

  // Link / Unlink Action
  const handleLinkIdentity = async (identity: TikTokIdentityReview, profileId: string | null, reason = 'Actualización en panel') => {
    setUpdatingId(identity.tiktok_id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await adminFetch('/api/admin/tiktok/identities', {
        method: 'PATCH',
        body: JSON.stringify({
          tiktok_id: identity.tiktok_id,
          profile_id: profileId,
          reason,
        }),
      });
      const data = await readApiPayload(res);
      if (!res.ok) throw new Error(String(data.error || 'No se pudo actualizar el vínculo'));

      // Optimistic update
      setIdentities((prev) =>
        prev.map((i) => {
          if (i.tiktok_id === identity.tiktok_id) {
            return {
              ...i,
              linked_profile_id: profileId,
              status: profileId ? 'linked' : 'unlinked',
            };
          }
          return i;
        })
      );

      const targetMember = profileId ? memberMap.get(profileId) : null;
      setActionSuccess(
        profileId && targetMember
          ? `Vínculo guardado: @${identity.display_id} emparejado con @${targetMember.robloxUser || targetMember.robloxDisplayName}`
          : `Vínculo removido para @${identity.display_id}`
      );
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al vincular identidad');
    } finally {
      setUpdatingId(null);
    }
  };

  // Rollback Action
  const handleRollback = async (batchId: string) => {
    const reason = window.prompt('Motivo de la reactivación/rollback del snapshot:');
    if (!reason || reason.trim().length < 3) return;
    setRollingBackId(batchId);
    try {
      const res = await adminFetch('/api/admin/tiktok/rankings', {
        method: 'POST',
        body: JSON.stringify({ batch_id: batchId, reason }),
      });
      const data = await readApiPayload(res);
      if (!res.ok) throw new Error(String(data.error || 'No se pudo reactivar el snapshot'));
      await loadData();
      setActionSuccess('Snapshot reactivado correctamente');
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error en rollback');
    } finally {
      setRollingBackId(null);
    }
  };

  const latest = operations?.latest_import;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-700/60 pb-5">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#FFC200] flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" /> Sincronización TikTok LIVE
          </span>
          <h1 className="font-display font-bold text-2xl text-white mt-0.5">Clasificaciones & Vinculación</h1>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Empareja las cuentas que aparecen en los rankings con los miembros oficiales de la comunidad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/clasificaciones"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1e1f22] border border-neutral-700/60 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:border-neutral-500 transition-colors"
          >
            Ver Clasificaciones <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FFC200] text-black font-bold text-xs rounded-xl hover:brightness-105 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Active Batch */}
        <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4.5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-[#FFC200]" /> Captura Publicada
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </div>
          <p className="text-sm font-bold text-white">
            {operations?.active_batch ? formatDate(operations.active_batch.captured_at) : 'Sin capturas activas'}
          </p>
          <p className="text-[10px] text-gray-400">
            {latest ? `Último envío: ${latest.sets_validated}/8 categorías validadas` : 'Listo para sincronizar'}
          </p>
        </div>

        {/* Card 2: Identities Linked */}
        <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4.5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-400" /> Identidades Vinculadas
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {counts.linked} / {counts.total}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-[#1e1f22] h-2 rounded-full overflow-hidden border border-neutral-700/40">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${counts.total > 0 ? (counts.linked / counts.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400">
            <span className="text-emerald-400 font-bold">{counts.linked} miembros vinculados</span>
            {counts.unlinked > 0 && <span className="text-gray-500"> · {counts.unlinked} pendientes</span>}
          </p>
        </div>

        {/* Card 3: Ingestion Status */}
        <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-4.5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Extensión de Ingestión
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
              operations?.import_token_configured
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {operations?.import_token_configured ? 'CONECTADA' : 'NO CONFIGURADA'}
            </span>
          </div>
          <p className="text-xs font-bold text-white">
            {operations?.import_token_configured ? 'Token de seguridad activo' : 'Requiere TIKTOK_IMPORT_TOKEN'}
          </p>
          <p className="text-[10px] text-gray-400">Captura automática vía Chrome Extension</p>
        </div>
      </div>

      {/* Main Section: Identity Management */}
      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 space-y-4 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-700/50 pb-4">
          <div>
            <h2 className="font-display font-semibold text-base text-white">Emparejamiento de Cuentas</h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Asigna a qué Miembro Oficial de Roblox pertenece cada cuenta de TikTok.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por @tiktok o @roblox..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1e1f22] border border-neutral-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC200] transition-colors"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('linked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'linked'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-[#1e1f22] text-gray-400 hover:text-white'
            }`}
          >
            ✅ Vinculados ({counts.linked})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unlinked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'unlinked'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-[#1e1f22] text-gray-400 hover:text-white'
            }`}
          >
            ⚠️ Por Vincular ({counts.unlinked})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#1e1f22] text-gray-400 hover:text-white'
            }`}
          >
            Todos ({counts.total})
          </button>
        </div>

        {/* List of Identities */}
        {loading ? (
          <div className="py-16 text-center text-xs font-bold uppercase tracking-wider text-gray-500 animate-pulse flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#FFC200]" /> Cargando identidades y vínculos...
          </div>
        ) : filteredIdentities.length === 0 ? (
          <div className="py-12 text-center bg-[#1e1f22] border border-dashed border-neutral-700/60 rounded-2xl p-6">
            <p className="text-white font-bold text-sm">
              {activeTab === 'unlinked' ? '¡Todo al día! No hay identidades pendientes.' : 'No se encontraron identidades.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === 'unlinked'
                ? 'Todas las cuentas detectadas en TikTok LIVE ya están emparejadas con miembros.'
                : 'Prueba cambiando de pestaña o término de búsqueda.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIdentities.map((identity) => {
              const isUpdating = updatingId === identity.tiktok_id;
              const linkedMember = identity.linked_profile_id ? memberMap.get(identity.linked_profile_id) : null;
              const isLinked = Boolean(identity.linked_profile_id);

              return (
                <div
                  key={identity.tiktok_id}
                  className={`bg-[#1e1f22] border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
                    isLinked ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-neutral-700/40'
                  }`}
                >
                  {/* Left: TikTok Account Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-[#2b2d31] border border-neutral-700/60 flex items-center justify-center font-bold text-lg text-[#FFC200] shrink-0 shadow-sm">
                      🎵
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-xs truncate">
                          @{identity.display_id}
                        </h4>
                        <span className="text-[10px] text-gray-500 font-mono">({identity.tiktok_id})</span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {identity.nickname || 'Sin Nickname'} ·{' '}
                        <span className="text-gray-300 font-medium">
                          🏆 {identity.ranking_entry_count} {identity.ranking_entry_count === 1 ? 'aparición' : 'apariciones'} en Top 10
                        </span>
                      </p>

                      {/* Linked Badge & Display */}
                      {isLinked && linkedMember && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Vinculado a {linkedMember.robloxDisplayName || linkedMember.robloxUser} (@{linkedMember.robloxUser})
                          </span>
                        </div>
                      )}

                      {/* Smart Candidate Auto-Match Button */}
                      {!isLinked && identity.candidates && identity.candidates.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Sugerencia:
                          </span>
                          {identity.candidates.map((cand) => (
                            <button
                              key={cand.id}
                              type="button"
                              disabled={isUpdating}
                              onClick={() => void handleLinkIdentity(identity, cand.id, 'Auto-match sugerencia de sistema')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                              ✨ Vincular con @{cand.roblox_user || cand.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Linked Member or Assignment Selector */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    {/* Member Selector (Pre-populated with current linked member!) */}
                    <div className="relative">
                      <select
                        aria-label="Seleccionar Miembro"
                        value={identity.linked_profile_id ?? ''}
                        disabled={isUpdating}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            void handleLinkIdentity(identity, val, 'Asignación manual en panel');
                          }
                        }}
                        className={`w-full sm:w-64 bg-[#2b2d31] border rounded-xl px-3 py-2 text-xs font-bold transition-colors cursor-pointer outline-none focus:border-[#FFC200] ${
                          isLinked
                            ? 'border-emerald-500/40 text-emerald-300 font-semibold'
                            : 'border-neutral-700/60 text-white'
                        }`}
                      >
                        <option value="" disabled={isLinked} className="bg-[#2b2d31] text-gray-400">
                          {isLinked ? 'Cambiar vinculación...' : '🔍 Seleccionar Miembro Oficial...'}
                        </option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id} className="bg-[#2b2d31] text-white">
                            {member.robloxDisplayName || member.robloxUser || member.email}
                            {member.robloxUser ? ` (@${member.robloxUser})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Unlink / Leave Unlinked Button */}
                    {isLinked ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void handleLinkIdentity(identity, null, 'Desvinculado manualmente')}
                        className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                        title="Quitar vínculo con este miembro"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Desvincular
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void handleLinkIdentity(identity, null, 'No es miembro oficial')}
                        className="px-3 py-2 rounded-xl bg-[#2b2d31] border border-neutral-700/60 text-gray-400 hover:text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                        title="Marcar como participante externo (sin vincular)"
                      >
                        No vincular
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced Technical History & Settings (Collapsible) */}
      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="w-full p-4.5 flex items-center justify-between text-left hover:bg-[#35373d]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            <span className="font-display font-bold text-xs text-white">
              Historial de Snapshots & Configuración Técnica
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span>{showAdvanced ? 'Ocultar' : 'Ver detalles'}</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-neutral-700/60 space-y-5 bg-[#1e1f22]/50 animate-fade-in">
            {/* Token Guide */}
            <div className="p-3.5 bg-[#1e1f22] border border-neutral-700/60 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#FFC200]" /> Rotación de Credenciales
              </p>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Para reconfigurar la extensión de Chrome, define <code className="text-[#FFC200]">TIKTOK_IMPORT_TOKEN</code> en las variables de entorno del servidor y luego introduce el mismo token en la extensión del navegador.
              </p>
            </div>

            {/* Snapshots History & Rollback */}
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-xs text-gray-300">Historial de Snapshots Publicados</h3>
              {(operations?.history ?? []).length === 0 ? (
                <p className="text-xs text-gray-500 py-3">No hay snapshots históricos.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                  {(operations?.history ?? []).map((snapshot) => {
                    const isActive = snapshot.batch_id === operations?.active_batch?.batch_id;
                    const isRollingBack = rollingBackId === snapshot.batch_id;

                    return (
                      <div
                        key={snapshot.batch_id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          isActive
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-[#1e1f22] border-neutral-700/40'
                        }`}
                      >
                        <div>
                          <p className="font-mono text-white text-[11px] break-all">{snapshot.batch_id}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Capturado: {formatDate(snapshot.captured_at)} · {snapshot.activations.length} activación(es)
                            {isActive && <span className="text-emerald-400 font-bold ml-1.5">● ACTIVO EN PORTAL</span>}
                          </p>
                        </div>

                        {!isActive && (
                          <button
                            type="button"
                            disabled={isRollingBack}
                            onClick={() => void handleRollback(snapshot.batch_id)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold text-xs transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
                          >
                            {isRollingBack ? 'Reactivando...' : 'Reactivar este snapshot'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Import Attempts */}
            <div className="space-y-2 pt-2 border-t border-neutral-700/40">
              <h3 className="font-display font-semibold text-xs text-gray-300">Últimos intentos de ingesta</h3>
              <div className="space-y-1.5">
                {(operations?.import_attempts ?? []).slice(0, 5).map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between text-[11px] p-2 bg-[#1e1f22] rounded-lg border border-neutral-700/30">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold ${attempt.sets_validated === 8 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {attempt.sets_validated}/8
                      </span>
                      <span className="text-gray-300">{attempt.status}</span>
                    </div>
                    <span className="text-gray-500 text-[10px]">{formatDate(attempt.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
