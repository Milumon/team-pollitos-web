'use client';

import { useEffect, useState, useMemo } from 'react';
import { adminFetch, readApiPayload } from './adminApi';
import { Megaphone, Activity, Users, Send, Check, RefreshCw } from 'lucide-react';

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
  minecraft_rank: 'pollito_invitado' | 'pollito_oficial' | 'pollito_moderador' | 'pollito_admin';
  is_admin: boolean;
  minecraft_accounts: MinecraftAccount[];
  has_minecraft: boolean;
};

type TemporaryReset = { username: string; password: string; expiresAt: string };

type BroadcastItem = {
  id: string;
  message: string;
  sent_by: string;
  delivered: boolean;
  created_at: string;
};

type ServerStatusData = {
  status: 'online' | 'offline' | 'unknown';
  stale: boolean;
  playerNames?: string[];
  playerCount?: number;
  maxPlayers?: number;
  tps?: number;
  mspt?: number;
  lastHeartbeatAt?: string | null;
  players?: { nickname: string | null; avatarUrl: string | null; java: string | null; bedrock: string | null }[];
};

const RANKS = [
  { value: 'pollito_invitado', label: 'Pollito Invitado', color: 'text-amber-400' },
  { value: 'pollito_oficial', label: 'Pollito Oficial', color: 'text-emerald-400' },
  { value: 'pollito_moderador', label: 'Pollito Moderador', color: 'text-purple-400' },
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
  const [activeTab, setActiveTab] = useState<'requests' | 'ranks' | 'broadcast' | 'metrics'>('requests');
  
  // Requests state
  const [requests, setRequests] = useState<MinecraftRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'java' | 'bedrock'>('all');
  
  // Ranks state
  const [rankUsers, setRankUsers] = useState<UserRankProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [rankOnlyWithMinecraft, setRankOnlyWithMinecraft] = useState(true);
  const [rankFilter, setRankFilter] = useState<'all' | 'pollito_invitado' | 'pollito_oficial' | 'pollito_moderador' | 'pollito_admin'>('all');
  
  // Broadcast & Metrics state
  const [serverStatus, setServerStatus] = useState<ServerStatusData | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Shared state
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [temporaryReset, setTemporaryReset] = useState<TemporaryReset | null>(null);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const loadRequests = async () => {
    try {
      const requestsResponse = await adminFetch('/api/admin/minecraft/requests');
      const requestsPayload = await readApiPayload(requestsResponse);
      if (!requestsResponse.ok) throw new Error(String(requestsPayload.error || 'No se pudieron cargar las solicitudes.'));
      setRequests((requestsPayload.requests as MinecraftRequest[]) ?? []);
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

  const loadBroadcastsAndStatus = async () => {
    try {
      const [statusRes, broadcastRes] = await Promise.all([
        fetch('/api/minecraft/status', { cache: 'no-store' }),
        adminFetch('/api/minecraft/broadcasts'),
      ]);
      if (statusRes.ok) {
        setServerStatus(await statusRes.json());
      }
      if (broadcastRes.ok) {
        const bPayload = await readApiPayload(broadcastRes);
        setBroadcasts((bPayload.broadcasts as BroadcastItem[]) || []);
      }
    } catch {
      // Handled silently
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadRequests(), loadRanks(), loadBroadcastsAndStatus()]);
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const sendBroadcastMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim() || sendingBroadcast) return;

    setSendingBroadcast(true);
    try {
      const res = await adminFetch('/api/minecraft/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastInput.trim() }),
      });

      if (res.ok) {
        setBroadcastInput('');
        setBroadcastSuccess(true);
        setTimeout(() => setBroadcastSuccess(false), 3000);
        showToast('Anuncio emitido a la cola del servidor');
        const reloadRes = await adminFetch('/api/minecraft/broadcasts');
        if (reloadRes.ok) {
          const payload = await readApiPayload(reloadRes);
          setBroadcasts((payload.broadcasts as BroadcastItem[]) || []);
        }
      }
    } catch (err) {
      console.error('Error sending broadcast:', err);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const update = async (accountId: string, action: 'approve' | 'reject' | 'revoke' | 'delete') => {
    if (action === 'delete' && !window.confirm('¿Eliminar definitivamente esta vinculación de Minecraft? El usuario del portal no se eliminará.')) return;
    const reason = action === 'reject' ? window.prompt('Motivo del rechazo')?.trim() : undefined;
    if (action === 'reject' && !reason) return;
    const response = await adminFetch('/api/admin/minecraft/requests', { method: 'POST', body: JSON.stringify({ accountId, action, reason }) });
    const payload = await readApiPayload(response);
    if (!response.ok) {
      setError(String(payload.error || 'No se pudo actualizar la solicitud.'));
      return;
    }
    showToast(`Acción completada: ${action}`);
    await loadRequests();
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

  const updateRank = async (userId: string, rank: string) => {
    const response = await adminFetch('/api/admin/minecraft/ranks', { method: 'POST', body: JSON.stringify({ userId, rank }) });
    const payload = await readApiPayload(response);
    if (!response.ok) {
      setError(String(payload.error || 'No se pudo actualizar el rango.'));
      return;
    }
    showToast(`Rango actualizado a ${rank}`);
    await loadRanks();
  };

  // Bulk actions handlers
  const handleBulkRequestAction = async (action: 'approve' | 'revoke' | 'delete') => {
    if (selectedRequestIds.size === 0) return;
    if (action === 'delete' && !window.confirm(`¿Eliminar definitivamente ${selectedRequestIds.size} vinculaciones seleccionadas?`)) return;
    
    setBulkActionLoading(true);
    let successCount = 0;
    for (const accountId of Array.from(selectedRequestIds)) {
      try {
        const response = await adminFetch('/api/admin/minecraft/requests', {
          method: 'POST',
          body: JSON.stringify({ accountId, action }),
        });
        if (response.ok) successCount++;
      } catch {
        // Continue with others
      }
    }
    setBulkActionLoading(false);
    setSelectedRequestIds(new Set());
    showToast(`${successCount} de ${selectedRequestIds.size} vinculaciones procesadas.`);
    await loadRequests();
  };

  const handleBulkRankUpdate = async (rank: string) => {
    if (selectedUserIds.size === 0) return;
    setBulkActionLoading(true);
    let successCount = 0;
    for (const userId of Array.from(selectedUserIds)) {
      try {
        const response = await adminFetch('/api/admin/minecraft/ranks', {
          method: 'POST',
          body: JSON.stringify({ userId, rank }),
        });
        if (response.ok) successCount++;
      } catch {
        // Continue with others
      }
    }
    setBulkActionLoading(false);
    setSelectedUserIds(new Set());
    showToast(`Rango ${rank} asignado a ${successCount} usuarios.`);
    await loadRanks();
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || r.username.toLowerCase().includes(q) || r.player_id.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      // Filter
      if (requestFilter === 'pending') return r.status === 'pending';
      if (requestFilter === 'approved') return r.status === 'approved';
      if (requestFilter === 'java') return r.edition === 'java';
      if (requestFilter === 'bedrock') return r.edition === 'bedrock';
      return true;
    });
  }, [requests, searchQuery, requestFilter]);

  // Filtered ranks
  const filteredRankUsers = useMemo(() => {
    return rankUsers.filter((u) => {
      // Only with MC
      if (rankOnlyWithMinecraft && !u.has_minecraft) return false;

      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (u.roblox_display_name && u.roblox_display_name.toLowerCase().includes(q)) || 
        (u.roblox_user && u.roblox_user.toLowerCase().includes(q)) ||
        u.minecraft_accounts.some(acc => acc.username.toLowerCase().includes(q));
      if (!matchesSearch) return false;

      // Filter
      if (rankFilter !== 'all' && u.minecraft_rank !== rankFilter) return false;
      return true;
    });
  }, [rankUsers, searchQuery, rankOnlyWithMinecraft, rankFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">Servidor & Juego</span>
          <h2 className="font-display font-bold text-xl text-white mt-0.5 flex items-center gap-2">
            ⛏️ Minecraft Admin
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            Gestiona vinculaciones, rangos, anuncios globales y métricas en vivo.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-400">{error}</p>}
      {successMessage && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-400 animate-in fade-in">{successMessage}</p>}

      {temporaryReset && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-5 text-sm text-amber-100">
          <p className="font-bold">Contraseña temporal para {temporaryReset.username}</p>
          <p className="mt-2 font-mono text-xl font-black tracking-wider">{temporaryReset.password}</p>
          <p className="mt-2 text-xs text-amber-200">Entrégala por privado. Expira a las {new Date(temporaryReset.expiresAt).toLocaleTimeString('es-PE')}. El jugador debe cambiarla dentro de Minecraft.</p>
          <button type="button" onClick={() => setTemporaryReset(null)} className="mt-3 rounded-lg border border-amber-300/40 px-3 py-2 text-xs font-bold text-amber-100 cursor-pointer">Ocultar contraseña</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'requests' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-neutral-800 text-gray-400 hover:text-white'}`}
        >
          Vinculaciones ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('ranks')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'ranks' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-neutral-800 text-gray-400 hover:text-white'}`}
        >
          Rangos ({rankUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'broadcast' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-neutral-800 text-gray-400 hover:text-white'}`}
        >
          <Megaphone className="w-3.5 h-3.5" /> Consola & Broadcast
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'metrics' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-neutral-800 text-gray-400 hover:text-white'}`}
        >
          <Activity className="w-3.5 h-3.5" /> Métricas en Vivo
        </button>
      </div>

      {/* Shared Search Input */}
      {(activeTab === 'requests' || activeTab === 'ranks') && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder={activeTab === 'requests' ? 'Buscar por usuario Minecraft...' : 'Buscar por usuario Roblox o Minecraft...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-yellow-400"
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando datos del servidor...</p>
      ) : activeTab === 'requests' ? (
        /* TAB: VINCULACIONES */
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-bold text-white">
                    {request.username} <span className="text-xs uppercase text-gray-500">{request.edition}</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-gray-500">{request.player_id}</p>
                  <p className={`mt-2 text-xs font-bold ${request.verified_at ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {requestStatus(request)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {request.status !== 'revoked' && (
                    <button onClick={() => void resetPassword(request)} className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer">
                      Resetear contraseña
                    </button>
                  )}
                  {request.status === 'pending' && (
                    <button onClick={() => void update(request.id, 'approve')} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer">
                      Aprobar
                    </button>
                  )}
                  {request.status === 'pending' && (
                    <button onClick={() => void update(request.id, 'reject')} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/30 cursor-pointer">
                      Rechazar
                    </button>
                  )}
                  {request.status === 'approved' && (
                    <button onClick={() => void update(request.id, 'revoke')} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/30 cursor-pointer">
                      Revocar
                    </button>
                  )}
                  <button onClick={() => void update(request.id, 'delete')} className="rounded-lg bg-red-700/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-700/50 cursor-pointer">
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
          {filteredRequests.length === 0 && <p className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 text-sm text-gray-500">No hay solicitudes coincidentes.</p>}
        </div>
      ) : activeTab === 'ranks' ? (
        /* TAB: RANGOS */
        <div className="space-y-3">
          {filteredRankUsers.map((user) => {
            const currentRank = RANKS.find(r => r.value === user.minecraft_rank) || RANKS[0];
            return (
              <article key={user.id} className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {user.roblox_avatar_url ? (
                      <img src={user.roblox_avatar_url} alt="" className="h-10 w-10 rounded-full" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center font-bold">🐣</div>
                    )}
                    <div>
                      <p className="font-display text-lg font-bold text-white">{user.roblox_display_name || user.roblox_user}</p>
                      <p className="mt-0.5 text-xs text-gray-500">@{user.roblox_user}</p>
                      <p className={`mt-1 text-xs font-bold ${currentRank.color}`}>{currentRank.label}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RANKS.map((rank) => (
                      <button
                        key={rank.value}
                        onClick={() => void updateRank(user.id, rank.value)}
                        disabled={user.minecraft_rank === rank.value}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          user.minecraft_rank === rank.value
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                            : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                        }`}
                      >
                        {rank.label}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
          {filteredRankUsers.length === 0 && <p className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 text-sm text-gray-500">No hay usuarios coincidentes.</p>}
        </div>
      ) : activeTab === 'broadcast' ? (
        /* TAB: CONSOLA & BROADCAST */
        <div className="space-y-6">
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-yellow-400" /> Enviar Anuncio Global al Servidor
            </h3>
            <p className="text-xs text-gray-400">
              El mensaje se emitirá en el chat de todos los jugadores conectados en Minecraft a través del plugin del servidor.
            </p>

            <form onSubmit={sendBroadcastMessage} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escribe tu anuncio (ej: ¡Evento de BedWars en 5 minutos!)..."
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  maxLength={256}
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-yellow-400"
                />
                <button
                  type="submit"
                  disabled={!broadcastInput.trim() || sendingBroadcast}
                  className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  <Send className="w-4 h-4" /> {sendingBroadcast ? 'Enviando...' : 'Emitir'}
                </button>
              </div>

              {broadcastSuccess && (
                <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> Anuncio enviado a la cola del servidor.
                </p>
              )}
            </form>
          </div>

          {/* Historial de Broadcasts */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-white text-sm">Historial Reciente de Anuncios</h4>
            {broadcasts.length === 0 ? (
              <p className="text-xs text-gray-500">No hay anuncios enviados todavía.</p>
            ) : (
              <div className="space-y-2">
                {broadcasts.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="text-white font-medium">&quot;{b.message}&quot;</p>
                      <p className="text-gray-500 text-[0.8em] mt-0.5">
                        Por {b.sent_by} · {new Date(b.created_at).toLocaleString('es-PE')}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[0.75em] ${
                      b.delivered ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {b.delivered ? '✓ Emitido' : '⏳ Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB: MÉTRICAS EN VIVO */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5">
              <span className="text-xs uppercase font-bold text-gray-500">Estado</span>
              <p className={`text-2xl font-black mt-2 ${serverStatus?.status === 'online' && !serverStatus.stale ? 'text-emerald-400' : 'text-red-400'}`}>
                {serverStatus?.status === 'online' && !serverStatus.stale ? 'Online' : 'Desconectado'}
              </p>
            </div>
            <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5">
              <span className="text-xs uppercase font-bold text-gray-500">Rendimiento (TPS)</span>
              <p className="text-2xl font-black text-yellow-400 mt-2">
                {serverStatus?.tps ? `${Number(serverStatus.tps).toFixed(1)} / 20.0` : '20.0 TPS'}
              </p>
            </div>
            <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5">
              <span className="text-xs uppercase font-bold text-gray-500">Jugadores Online</span>
              <p className="text-2xl font-black text-sky-400 mt-2">
                {serverStatus?.playerCount ?? 0} / {serverStatus?.maxPlayers ?? 20}
              </p>
            </div>
          </div>

          {/* Jugadores en el servidor */}
          <div className="bg-[#2b2d31] border border-neutral-700/60 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-yellow-400" /> Jugadores Actualmente Conectados
            </h4>
            {(!serverStatus?.players || serverStatus.players.length === 0) ? (
              <p className="text-xs text-gray-500">No hay jugadores en línea en este momento.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {serverStatus.players.map((p, idx) => (
                  <div key={idx} className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center gap-3">
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center font-bold text-sm">
                        🐣
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-sm truncate">{p.nickname || p.java || p.bedrock}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {p.java ? `Java: ${p.java}` : `Bedrock: ${p.bedrock}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}