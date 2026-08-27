'use client';

import { useEffect, useState } from 'react';

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
  const [requests, setRequests] = useState<MinecraftRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [temporaryReset, setTemporaryReset] = useState<TemporaryReset | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'ranks'>('requests');

  const load = async () => {
    setLoading(true);
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
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { queueMicrotask(() => void load()); }, []);

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
    await load();
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
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Servidor</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-white">Minecraft Admin</h1>
        <p className="mt-2 text-xs font-semibold text-gray-400">Gestiona vinculaciones y rangos de Minecraft.</p>
      </div>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-400">{error}</p>}

      {temporaryReset && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-5 text-sm text-amber-100">
          <p className="font-bold">Contraseña temporal para {temporaryReset.username}</p>
          <p className="mt-2 font-mono text-xl font-black tracking-wider">{temporaryReset.password}</p>
          <p className="mt-2 text-xs text-amber-200">Entrégala por privado. Expira a las {new Date(temporaryReset.expiresAt).toLocaleTimeString('es-PE')}. El jugador debe cambiarla dentro de Minecraft.</p>
          <button type="button" onClick={() => setTemporaryReset(null)} className="mt-3 rounded-lg border border-amber-300/40 px-3 py-2 text-xs font-bold text-amber-100">Ocultar contraseña</button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === 'requests' ? 'bg-blue-500/20 text-blue-200' : 'bg-neutral-700/50 text-gray-400'}`}
        >
          Vinculaciones
        </button>
        <button
          onClick={() => setActiveTab('ranks')}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === 'ranks' ? 'bg-blue-500/20 text-blue-200' : 'bg-neutral-700/50 text-gray-400'}`}
        >
          Rangos
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : activeTab === 'requests' ? (
        <div className="space-y-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-bold text-white">{request.username} <span className="text-xs uppercase text-gray-500">{request.edition}</span></p>
                  <p className="mt-1 font-mono text-xs text-gray-500">{request.player_id}</p>
                  <p className={`mt-2 text-xs font-bold ${request.verified_at ? 'text-emerald-300' : 'text-amber-300'}`}>{requestStatus(request)}</p>
                </div>
                <div className="flex gap-2">
                  {request.status !== 'revoked' && <button onClick={() => void resetPassword(request)} className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200">Resetear contraseña</button>}
                  {request.status === 'pending' && <button onClick={() => void update(request.id, 'reject')} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200">Rechazar</button>}
                  {request.status === 'approved' && <button onClick={() => void update(request.id, 'revoke')} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200">Revocar</button>}
                  <button onClick={() => void update(request.id, 'delete')} className="rounded-lg bg-red-700/30 px-3 py-2 text-xs font-bold text-red-200">Eliminar</button>
                </div>
              </div>
            </article>
          ))}
          {requests.length === 0 && <p className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 text-sm text-gray-500">No hay solicitudes de Minecraft.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => {
            const currentRank = RANKS.find(r => r.value === profile.minecraft_rank) || RANKS[0];
            return (
              <article key={profile.id} className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {profile.roblox_avatar_url && (
                      <img src={profile.roblox_avatar_url} alt="" className="h-10 w-10 rounded-full" />
                    )}
                    <div>
                      <p className="font-display text-lg font-bold text-white">{profile.roblox_display_name || profile.roblox_user}</p>
                      <p className="mt-1 text-xs text-gray-500">@{profile.roblox_user}</p>
                      <p className={`mt-1 text-xs font-bold ${currentRank.color}`}>{currentRank.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {RANKS.map((rank) => (
                      <button
                        key={rank.value}
                        onClick={() => void updateRank(profile.id, rank.value)}
                        disabled={profile.minecraft_rank === rank.value}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${
                          profile.minecraft_rank === rank.value
                            ? 'bg-green-500/20 text-green-300 cursor-default'
                            : 'bg-neutral-700/50 text-gray-400 hover:bg-neutral-600/50'
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
          {profiles.length === 0 && <p className="rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-5 text-sm text-gray-500">No hay perfiles con rangos asignados.</p>}
        </div>
      )}
    </div>
  );
}
