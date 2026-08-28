'use client';

import { useEffect, useState, useMemo } from 'react';
import { adminFetch, readApiPayload } from './adminApi';

type MinecraftRequest = {
  id: string;
  user_id: string;
  edition: 'java' | 'bedrock';
  username: string;
  player_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
};

type MinecraftAccount = {
  id: string;
  username: string;
  edition: string;
  status: string;
};

type UserRankProfile = {
  id: string;
  roblox_user: string;
  roblox_display_name: string;
  roblox_avatar_url: string | null;
  minecraft_rank: 'pollito_invitado' | 'pollito_oficial' | 'pollito_admin';
  is_admin: boolean;
  minecraft_accounts: MinecraftAccount[];
  has_minecraft: boolean;
};

type Profile = {
  id: string;
  roblox_user: string;
  roblox_display_name: string;
  roblox_avatar_url: string | null;
  link_status: string;
  minecraft_rank: string | null;
};

type TemporaryReset = { username: string; password: string; expiresAt: string };

const RANKS = [
  { value: 'pollito_invitado', label: 'Pollito Invitado', color: 'text-gray-400' },
  { value: 'pollito_oficial', label: 'Pollito Oficial', color: 'text-yellow-400' },
  { value: 'pollito_admin', label: 'Pollito Admin', color: 'text-red-400' },
];

function requestStatus(request: MinecraftRequest) {
  if (request.status === 'pending' && request.verified_at) return 'Identidad verificada · acceso automático';
  if (request.status === 'pending') return 'Pendiente de verificación dentro del servidor';
  if (request.status === 'approved') return 'Aprobada · acceso activo';
  if (request.status === 'rejected') return 'Rechazada';
  return 'Revocada';
}

export default function MinecraftAdminView() {
  const [activeTab, setActiveTab] = useState<'requests' | 'ranks'>('requests');
  
  // Requests state
  const [requests, setRequests] = useState<MinecraftRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'java' | 'bedrock'>('all');
  
  // Ranks state
  const [rankUsers, setRankUsers] = useState<UserRankProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [rankOnlyWithMinecraft, setRankOnlyWithMinecraft] = useState(true);
  const [rankFilter, setRankFilter] = useState<'all' | 'pollito_invitado' | 'pollito_oficial' | 'pollito_admin'>('all');
  
  // Shared state
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [temporaryReset, setTemporaryReset] = useState<TemporaryReset | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'ranks'>('requests');

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const loadRequests = async () => {
    try {
      const [requestsResponse, ranksResponse] = await Promise.all([
        adminFetch('/api/admin/minecraft/requests'),
        adminFetch('/api/admin/minecraft/ranks'),
      ]);
      
      const requestsPayload = await readApiPayload(requestsResponse);
      if (!requestsResponse.ok) throw new Error(String(requestsPayload.error || 'No se pudieron cargar las solicitudes.'));
      setRequests((requestsPayload.requests as MinecraftRequest[]) ?? []);

      const ranksPayload = await readApiPayload(ranksResponse);
      if (ranksResponse.ok) {
        setProfiles((ranksPayload.profiles as Profile[]) ?? []);
      }
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las solicitudes.');
    }
  };

  const loadRanks = async () => {
    try {
      const response = await adminFetch('/api/admin/minecraft/ranks');
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'No se pudieron cargar los rangos.'));
      setRankUsers((payload.users as UserRankProfile[]) ?? []);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los rangos.');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadRequests(), loadRanks()]);
    setLoading(false);
  };

  useEffect(() => { void loadAll(); }, []);

  // Request single action
  const updateRequest = async (accountId: string, action: 'approve' | 'reject' | 'revoke' | 'delete') => {
    if (action === 'delete' && !window.confirm('¿Eliminar definitivamente esta vinculación de Minecraft?')) return;
    const reason = action === 'reject' ? window.prompt('Motivo del rechazo')?.trim() : undefined;
    if (action === 'reject' && !reason) return;
    
    const response = await adminFetch('/api/admin/minecraft/requests', { method: 'POST', body: JSON.stringify({ accountId, action, reason }) });
    const payload = await readApiPayload(response);
    if (!response.ok) {
      setError(String(payload.error || 'No se pudo actualizar la solicitud.'));
      return;
    }
    showToast('Solicitud actualizada con éxito.');
    await loadRequests();
  };

  // Bulk Request Action
  const handleBulkRequestAction = async (action: 'approve' | 'reject' | 'revoke' | 'delete') => {
    const ids = Array.from(selectedRequestIds);
    if (ids.length === 0) return;
    if (action === 'delete' && !window.confirm(`¿Eliminar definitivamente ${ids.length} vinculaciones de Minecraft?`)) return;
    
    setBulkActionLoading(true);
    try {
      const response = await adminFetch('/api/admin/minecraft/requests/bulk', {
        method: 'POST',
        body: JSON.stringify({ accountIds: ids, action })
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Error en acción masiva.'));
      
      showToast(`Acción completada en ${ids.length} solicitudes.`);
      setSelectedRequestIds(new Set());
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error en acción masiva.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Single Rank update
  const updateRank = async (userId: string, rank: string) => {
    const response = await adminFetch('/api/admin/minecraft/ranks', {
      method: 'POST',
      body: JSON.stringify({ userId, rank })
    });
    const payload = await readApiPayload(response);
    if (!response.ok) {
      setError(String(payload.error || 'No se pudo actualizar el rango.'));
      return;
    }
    showToast('Rango actualizado con éxito.');
    await loadRanks();
  };

  // Bulk Rank update
  const handleBulkRankUpdate = async (rank: string) => {
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;

    setBulkActionLoading(true);
    try {
      const response = await adminFetch('/api/admin/minecraft/ranks/bulk', {
        method: 'POST',
        body: JSON.stringify({ userIds: ids, rank })
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Error en actualización masiva de rangos.'));
      
      showToast(`Rango asignado a ${ids.length} usuarios.`);
      setSelectedUserIds(new Set());
      await loadRanks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error en actualización masiva.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const resetPassword = async (request: MinecraftRequest) => {
    if (!window.confirm(`¿Generar una contraseña temporal para ${request.username}? La contraseña actual dejará de funcionar.`)) return;
    const response = await adminFetch('/api/admin/minecraft/requests', { method: 'POST', body: JSON.stringify({ accountId: request.id, action: 'reset_password' }) });
    const payload = await readApiPayload(response);
    if (!response.ok) {
      setError(String(payload.error || 'No se pudo generar la contraseña temporal.'));
      return;
    }
    setTemporaryReset({ username: request.username, password: String(payload.temporaryPassword), expiresAt: String(payload.expiresAt) });
  };

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch = req.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            req.player_id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (requestFilter === 'pending') return req.status === 'pending';
      if (requestFilter === 'approved') return req.status === 'approved';
      if (requestFilter === 'java') return req.edition === 'java';
      if (requestFilter === 'bedrock') return req.edition === 'bedrock';
      return true;
    });
  }, [requests, searchQuery, requestFilter]);

  // Filtered Rank Users
  const filteredRankUsers = useMemo(() => {
    return rankUsers.filter((u) => {
      if (rankOnlyWithMinecraft && !u.has_minecraft) return false;
      const matchesSearch = u.roblox_display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            u.roblox_user.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            u.minecraft_accounts.some((a) => a.username.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;
      if (rankFilter !== 'all' && u.minecraft_rank !== rankFilter) return false;
      return true;
    });
  }, [rankUsers, searchQuery, rankOnlyWithMinecraft, rankFilter]);

  // Toggle selection helpers
  const toggleRequestSelection = (id: string) => {
    const next = new Set(selectedRequestIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRequestIds(next);
  };

  const toggleAllRequests = () => {
    if (selectedRequestIds.size === filteredRequests.length && filteredRequests.length > 0) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(filteredRequests.map((r) => r.id)));
    }
  };

  const toggleUserSelection = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUserIds(next);
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.size === filteredRankUsers.length && filteredRankUsers.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredRankUsers.map((u) => u.id)));
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Servidor</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-white">Minecraft Admin</h1>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Gestiona vinculaciones, solicitudes y rangos sincronizados con el servidor.
          </p>
        </div>

        <div className="flex rounded-xl bg-neutral-900/80 p-1 border border-neutral-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('requests'); setSearchQuery(''); }}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${activeTab === 'requests' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}
          >
            Vinculaciones ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('ranks'); setSearchQuery(''); }}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${activeTab === 'ranks' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}
          >
            Rangos ({rankUsers.filter((u) => u.has_minecraft).length})
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-bold text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-400">
          {successMessage}
        </div>
      )}

      {/* Temporary Password Box */}
      {temporaryReset && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-5 text-sm text-amber-100 shadow-xl">
          <p className="font-bold">Contraseña temporal para {temporaryReset.username}</p>
          <p className="mt-2 font-mono text-xl font-black tracking-wider text-amber-300">{temporaryReset.password}</p>
          <p className="mt-2 text-xs text-amber-200">
            Entrégala por privado. Expira a las {new Date(temporaryReset.expiresAt).toLocaleTimeString('es-PE')}. El jugador debe cambiarla dentro de Minecraft con /changepassword.
          </p>
          <button type="button" onClick={() => setTemporaryReset(null)} className="mt-3 rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-400/20">
            Ocultar contraseña
          </button>
        </div>
      )}

      {/* Controls Bar (Search + Filters + Select All) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-[#232428] p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={activeTab === 'requests' ? (selectedRequestIds.size > 0 && selectedRequestIds.size === filteredRequests.length) : (selectedUserIds.size > 0 && selectedUserIds.size === filteredRankUsers.length)}
            onChange={activeTab === 'requests' ? toggleAllRequests : toggleAllUsers}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-neutral-900 cursor-pointer"
          />
          <span className="text-xs font-bold text-gray-300">
            {activeTab === 'requests' ? (selectedRequestIds.size > 0 ? `${selectedRequestIds.size} de ${filteredRequests.length} seleccionados` : `Seleccionar todos (${filteredRequests.length})`) : (selectedUserIds.size > 0 ? `${selectedUserIds.size} de ${filteredRankUsers.length} seleccionados` : `Seleccionar todos (${filteredRankUsers.length})`)}
          </span>
        </div>

        {/* Search input */}
        <div className="flex-1 max-w-xs">
          <input
            type="text"
            placeholder={activeTab === 'requests' ? 'Buscar por usuario o ID...' : 'Buscar usuario o Minecraft...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-[#1e1f22] px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {activeTab === 'requests' ? (
            <>
              {(['all', 'pending', 'approved', 'java', 'bedrock'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRequestFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${requestFilter === f ? 'bg-amber-500 text-black' : 'bg-neutral-800/80 text-gray-400 hover:text-white hover:bg-neutral-700'}`}
                >
                  {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : f}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRankOnlyWithMinecraft(!rankOnlyWithMinecraft)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${rankOnlyWithMinecraft ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-neutral-800/80 text-gray-400 hover:text-white'}`}
              >
                🎮 {rankOnlyWithMinecraft ? 'Solo con Minecraft' : 'Todos los usuarios'}
              </button>
              {(['all', 'pollito_invitado', 'pollito_oficial', 'pollito_admin'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRankFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${rankFilter === f ? 'bg-amber-500 text-black' : 'bg-neutral-800/80 text-gray-400 hover:text-white hover:bg-neutral-700'}`}
                >
                  {f === 'all' ? 'Todos' : f === 'pollito_invitado' ? 'Invitados' : f === 'pollito_oficial' ? 'Oficiales' : 'Admins'}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent"></div>
        </div>
      ) : activeTab === 'requests' ? (
        /* TAB 1: VINCULACIONES */
        filteredRequests.length === 0 ? (
          <p className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-8 text-center text-sm text-gray-400">
            No se encontraron vinculaciones de Minecraft con los filtros seleccionados.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const isSelected = selectedRequestIds.has(request.id);
              return (
                <article
                  key={request.id}
                  onClick={() => toggleRequestSelection(request.id)}
                  className={`cursor-pointer rounded-2xl border transition-all p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] ${isSelected ? 'border-amber-500 bg-[#313338] ring-1 ring-amber-500' : 'border-neutral-700/60 bg-[#2b2d31] hover:border-neutral-600'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRequestSelection(request.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1.5 h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <div>
                        <p className="font-display text-lg font-bold text-white flex items-center gap-2">
                          {request.username}
                          <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-black uppercase text-gray-400 border border-neutral-700">
                            {request.edition}
                          </span>
                        </p>
                        <p className="mt-1 font-mono text-xs text-gray-500">{request.player_id}</p>
                        <p className={`mt-2 text-xs font-bold ${request.verified_at ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {requestStatus(request)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                      {request.status !== 'revoked' && (
                        <button
                          type="button"
                          onClick={() => void resetPassword(request)}
                          className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 py-2 text-xs font-bold text-amber-200 transition-colors"
                        >
                          Resetear contraseña
                        </button>
                      )}
                      {request.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => void updateRequest(request.id, 'reject')}
                          className="rounded-lg bg-red-500/20 hover:bg-red-500/30 px-3 py-2 text-xs font-bold text-red-200 transition-colors"
                        >
                          Rechazar
                        </button>
                      )}
                      {request.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => void updateRequest(request.id, 'revoke')}
                          className="rounded-lg bg-red-500/20 hover:bg-red-500/30 px-3 py-2 text-xs font-bold text-red-200 transition-colors"
                        >
                          Revocar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void updateRequest(request.id, 'delete')}
                        className="rounded-lg bg-red-700/30 hover:bg-red-700/50 px-3 py-2 text-xs font-bold text-red-200 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* TAB 2: RANGOS */
        filteredRankUsers.length === 0 ? (
          <p className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-8 text-center text-sm text-gray-400">
            No se encontraron usuarios para los filtros seleccionados.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRankUsers.map((user) => {
              const isSelected = selectedUserIds.has(user.id);
              return (
                <article
                  key={user.id}
                  onClick={() => toggleUserSelection(user.id)}
                  className={`cursor-pointer rounded-2xl border transition-all p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] ${isSelected ? 'border-amber-500 bg-[#313338] ring-1 ring-amber-500' : 'border-neutral-700/60 bg-[#2b2d31] hover:border-neutral-600'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(user.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      
                      <div className="h-12 w-12 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {user.roblox_avatar_url ? (
                          <img src={user.roblox_avatar_url} alt={user.roblox_display_name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl">🐣</span>
                        )}
                      </div>

                      <div>
                        <p className="font-display text-base font-bold text-white flex items-center gap-2">
                          {user.roblox_display_name}
                          <span className="text-xs font-normal text-gray-400 font-sans">@{user.roblox_user}</span>
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {user.minecraft_accounts.length > 0 ? (
                            user.minecraft_accounts.map((acc) => (
                              <span key={acc.id} className="rounded bg-neutral-800 px-2 py-0.5 text-[11px] font-mono text-amber-300 border border-neutral-700 flex items-center gap-1">
                                🎮 {acc.username} <span className="text-[9px] uppercase text-gray-500 font-bold">({acc.edition})</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-500 italic">Sin cuenta Minecraft</span>
                          )}

                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                            user.is_admin ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                            user.minecraft_rank === 'pollito_oficial' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {user.is_admin ? 'Admin 🐣' : user.minecraft_rank === 'pollito_oficial' ? 'Pollito Oficial 🐣' : 'Pollito Invitado 🐣'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rank Selection Buttons */}
                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => void updateRank(user.id, 'pollito_invitado')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          user.minecraft_rank === 'pollito_invitado' && !user.is_admin
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                            : 'bg-neutral-800 text-gray-400 hover:text-white hover:bg-neutral-700'
                        }`}
                      >
                        Pollito Invitado
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateRank(user.id, 'pollito_oficial')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          user.minecraft_rank === 'pollito_oficial' && !user.is_admin
                            ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                            : 'bg-neutral-800 text-gray-400 hover:text-white hover:bg-neutral-700'
                        }`}
                      >
                        Pollito Oficial
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateRank(user.id, 'pollito_admin')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          user.minecraft_rank === 'pollito_admin' || user.is_admin
                            ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                            : 'bg-neutral-800 text-gray-400 hover:text-white hover:bg-neutral-700'
                        }`}
                      >
                        Pollito Admin
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {/* FLOATING BULK ACTION BAR */}
      {((activeTab === 'requests' && selectedRequestIds.size > 0) || (activeTab === 'ranks' && selectedUserIds.size > 0)) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-3xl animate-slide-up">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/50 bg-[#1e1f22]/95 px-5 py-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-black">
                {activeTab === 'requests' ? selectedRequestIds.size : selectedUserIds.size}
              </span>
              <div>
                <p className="text-xs font-bold text-white">
                  {activeTab === 'requests'
                    ? `${selectedRequestIds.size} vinculaciones seleccionadas`
                    : `${selectedUserIds.size} usuarios seleccionados`}
                </p>
                <p className="text-[10px] text-gray-400">Aplica una acción en lote a todos los seleccionados</p>
              </div>
            </div>

            {/* Actions for current tab */}
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'requests' ? (
                <>
                  <button
                    type="button"
                    disabled={bulkActionLoading}
                    onClick={() => void handleBulkRequestAction('approve')}
                    className="rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-md cursor-pointer"
                  >
                    Aprobar Selección
                  </button>
                  <button
                    type="button"
                    disabled={bulkActionLoading}
                    onClick={() => void handleBulkRequestAction('revoke')}
                    className="rounded-xl bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Revocar
                  </button>
                  <button
                    type="button"
                    disabled={bulkActionLoading}
                    onClick={() => void handleBulkRequestAction('delete')}
                    className="rounded-xl bg-red-600/30 px-3.5 py-2 text-xs font-bold text-red-200 hover:bg-red-600/50 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Eliminar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={bulkActionLoading}
                    onClick={() => void handleBulkRankUpdate('pollito_invitado')}
                    className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-all shadow-md cursor-pointer"
                  >
                    Asignar Invitado
                  </button>
                  <button
                    type="button"
                    disabled={bulkActionLoading}
                    onClick={() => void handleBulkRankUpdate('pollito_oficial')}
                    className="rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-md cursor-pointer"
                  >
                    Asignar Oficial
                  </button>
                  <button
                    type="button"
                    disabled={bulkActionLoading}
                    onClick={() => void handleBulkRankUpdate('pollito_admin')}
                    className="rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-400 disabled:opacity-50 transition-all shadow-md cursor-pointer"
                  >
                    Asignar Admin
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedRequestIds(new Set());
                  setSelectedUserIds(new Set());
                }}
                className="ml-2 rounded-xl bg-neutral-800 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-neutral-700 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
