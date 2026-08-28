'use client';

import {
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  Volume2,
  VolumeX,
  Gamepad2,
  Edit3,
  CheckSquare,
  Square,
  Crown,
  Sparkles,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';

import { adminFetch, readApiPayload } from './adminApi';
import { useAdminUsers } from './AdminUsersProvider';
import { getAdminUserStatusLabel, type AdminUser } from './types';

const USERS_PER_PAGE = 15;
const focusClassName = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC200] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1f22]';

type FilterTab = 'all' | 'approved' | 'pending' | 'rejected' | 'staff' | 'official' | 'guest';

export function AdminUsersList() {
  const { users, loading, error, refresh } = useAdminUsers();
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const search = searchParams?.get('busqueda') || '';
  const deferredSearch = useDeferredValue(search);
  const requestedPage = Number(searchParams?.get('pagina'));

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Tab Filtering & Search
  const filteredUsers = useMemo(() => {
    let result = users;

    if (activeTab === 'approved') {
      result = result.filter((u) => u.linkStatus === 'approved');
    } else if (activeTab === 'pending') {
      result = result.filter((u) => u.linkStatus === 'pending');
    } else if (activeTab === 'rejected') {
      result = result.filter((u) => u.linkStatus === 'rejected');
    } else if (activeTab === 'staff') {
      result = result.filter((u) => u.isAdmin || u.minecraftRank === 'pollito_admin' || u.minecraftRank === 'pollito_moderador');
    } else if (activeTab === 'official') {
      result = result.filter((u) => u.minecraftRank === 'pollito_oficial');
    } else if (activeTab === 'guest') {
      result = result.filter((u) => u.minecraftRank === 'pollito_invitado' || (!u.minecraftRank && u.linkStatus !== 'approved'));
    }

    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) return result;

    return result.filter((user) =>
      [user.email, user.robloxUser ?? '', user.robloxDisplayName ?? '', user.tiktokUser ?? '', user.id]
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [activeTab, deferredSearch, users]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: users.length,
      approved: users.filter((u) => u.linkStatus === 'approved').length,
      pending: users.filter((u) => u.linkStatus === 'pending').length,
      rejected: users.filter((u) => u.linkStatus === 'rejected').length,
      staff: users.filter((u) => u.isAdmin || u.minecraftRank === 'pollito_admin' || u.minecraftRank === 'pollito_moderador').length,
      official: users.filter((u) => u.minecraftRank === 'pollito_oficial').length,
      guest: users.filter((u) => u.minecraftRank === 'pollito_invitado').length,
    };
  }, [users]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const visibleUsers = filteredUsers.slice((page - 1) * USERS_PER_PAGE, page * USERS_PER_PAGE);

  const navigateToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (nextPage > 1) params.set('pagina', String(nextPage));
    else params.delete('pagina');
    const query = params.toString();
    const destination = query ? `${pathname}?${query}` : pathname;
    window.history.pushState(null, '', destination);
  };

  // Selection handlers
  const toggleSelectUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (selectedIds.size === visibleUsers.length && visibleUsers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleUsers.map((u) => u.id)));
    }
  };

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  // Single Action
  const runAction = async (userId: string, path: string, body: Record<string, unknown>) => {
    setUpdatingId(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await adminFetch(path, { method: 'POST', body: JSON.stringify(body) });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'No se pudo actualizar el usuario'));
      await refresh();
      setActionSuccess('Usuario actualizado correctamente');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el usuario');
    } finally {
      setUpdatingId(null);
    }
  };

  // Bulk Actions
  const runBulkAction = async (action: string, extraBody: Record<string, unknown> = {}) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await adminFetch('/api/admin/users/bulk', {
        method: 'POST',
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          action,
          ...extraBody,
        }),
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'Error al ejecutar acción masiva'));

      await refresh();
      setActionSuccess(String(payload.message || 'Acción masiva completada exitosamente'));
      setSelectedIds(new Set());
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (bulkErr) {
      setActionError(bulkErr instanceof Error ? bulkErr.message : 'Error en acción masiva');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <section className="space-y-4 sm:space-y-5 rounded-2xl border border-neutral-700/60 bg-[#2b2d31] p-3.5 sm:p-5 shadow-[0_4px_12px_rgba(0,0,0,.25)] animate-fade-in relative pb-28 sm:pb-24">
      {/* Header & Search */}
      <div className="flex flex-col gap-3.5 border-b border-neutral-700/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Padrón de Miembros</span>
          <h1 className="mt-0.5 font-display text-lg sm:text-xl font-bold leading-none text-white">Gestión de Usuarios</h1>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Administra perfiles de Roblox, estado de vinculación, rangos unificados y permisos.
          </p>
        </div>

        <form action={pathname} className="relative w-full shrink-0 sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            defaultValue={search}
            name="busqueda"
            aria-label="Buscar usuarios"
            placeholder="Buscar usuario, display, email..."
            className={`w-full rounded-xl border border-neutral-700/60 bg-[#202226] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-[#FFC200] transition-colors ${focusClassName}`}
          />
        </form>
      </div>

      {/* Filter Tabs - Horizontal Scroll on Mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex overflow-x-auto pb-1 sm:pb-0 gap-1.5 rounded-xl border border-neutral-700/60 bg-[#202226] p-1 text-xs font-bold no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'all' ? 'bg-amber-500 text-black shadow-sm font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos ({tabCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'approved' ? 'bg-emerald-500 text-black shadow-sm font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Aprobados ({tabCounts.approved})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'pending' ? 'bg-yellow-500 text-black shadow-sm font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Pendientes ({tabCounts.pending})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'rejected' ? 'bg-red-500 text-white shadow-sm font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Rechazados ({tabCounts.rejected})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'staff' ? 'bg-purple-500 text-white shadow-sm font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Staff / Mod ({tabCounts.staff})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('official')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'official' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Oficiales ({tabCounts.official})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guest')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'guest' ? 'bg-amber-600 text-white shadow-sm font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Invitados ({tabCounts.guest})
          </button>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAllVisible}
            className="flex flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-lg border border-neutral-700/60 bg-[#202226] px-2.5 sm:px-3 py-1.5 font-bold text-gray-300 hover:text-white transition-colors cursor-pointer text-[11px] sm:text-xs"
          >
            {selectedIds.size === visibleUsers.length && visibleUsers.length > 0 ? (
              <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 shrink-0" />
            ) : (
              <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 shrink-0" />
            )}
            Página ({visibleUsers.length})
          </button>
          <button
            type="button"
            onClick={selectAllFiltered}
            className="flex flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-lg border border-neutral-700/60 bg-[#202226] px-2.5 sm:px-3 py-1.5 font-bold text-gray-300 hover:text-white transition-colors cursor-pointer text-[11px] sm:text-xs"
          >
            {selectedIds.size === filteredUsers.length && filteredUsers.length > 0 ? (
              <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 shrink-0" />
            ) : (
              <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 shrink-0" />
            )}
            Filtrados ({filteredUsers.length})
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(error || actionError) && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-400 animate-fade-in">
          {error || actionError}
        </p>
      )}
      {actionSuccess && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-400 animate-fade-in">
          {actionSuccess}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-gray-400">Cargando padrón de usuarios...</p>
        </div>
      ) : visibleUsers.length === 0 ? (
        <div className="rounded-xl border border-neutral-700/60 bg-[#202226] py-16 text-center">
          <p className="font-display text-sm font-bold text-white">No se encontraron usuarios</p>
          <p className="mt-1 text-xs text-gray-400">Prueba ajustando el término de búsqueda o cambiando de pestaña.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ========================================================= */}
          {/* 1. MOBILE CARD VIEW (Visible on screens < md)            */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {visibleUsers.map((user) => {
              const isSelected = selectedIds.has(user.id);
              const isOwner = user.email.toLowerCase().includes('milumon') || user.minecraftRank === 'pollito_admin';
              const isMod = user.minecraftRank === 'pollito_moderador';
              const isOficial = user.minecraftRank === 'pollito_oficial';

              return (
                <div
                  key={user.id}
                  onClick={() => toggleSelectUser(user.id)}
                  className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500/50 bg-amber-500/10 shadow-sm'
                      : 'border-neutral-700/60 bg-[#202226] hover:border-neutral-600'
                  }`}
                >
                  {/* Top: Checkbox, Avatar, User Info & Badges */}
                  <div className="flex items-start gap-3">
                    <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectUser(user.id)}
                        className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                    </div>

                    {user.robloxAvatarUrl ? (
                      <img
                        src={user.robloxAvatarUrl}
                        alt={user.robloxDisplayName || user.robloxUser || 'Avatar'}
                        className="h-11 w-11 shrink-0 rounded-xl border border-neutral-700/60 bg-neutral-800 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-700/60 bg-neutral-800 text-lg">
                        🐣
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-bold text-white text-sm">
                          {user.robloxDisplayName || 'Usuario'}
                        </p>
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            isOwner
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : isMod
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : isOficial
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isOwner && <Crown className="h-2.5 w-2.5 text-red-400" />}
                          {isMod && <Shield className="h-2.5 w-2.5 text-purple-400" />}
                          {isOficial && '👑'}
                          {!isOwner && !isMod && !isOficial && '🐣'}
                          {isOwner ? 'Admin' : isMod ? 'Mod' : isOficial ? 'Oficial' : 'Invitado'}
                        </span>
                      </div>
                      <p className="truncate text-xs text-gray-400">@{user.robloxUser || 'sin-roblox'}</p>
                      <p className="truncate text-[10px] text-gray-500 font-mono mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  {/* Status & Permissions Subrow */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-700/40 pt-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          user.linkStatus === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : user.linkStatus === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            : user.linkStatus === 'rejected'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-neutral-800 text-gray-400 border border-neutral-700'
                        }`}
                      >
                        {user.linkStatus === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                        {user.linkStatus === 'rejected' && <XCircle className="h-3 w-3" />}
                        {getAdminUserStatusLabel(user.linkStatus)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void runAction(user.id, '/api/admin/users/soundboard-toggle', {
                            userId: user.id,
                            disabled: !user.soundboardDisabled,
                          });
                        }}
                        disabled={updatingId === user.id}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          user.soundboardDisabled
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {user.soundboardDisabled ? (
                          <>
                            <VolumeX className="h-3 w-3" /> Audio Bloqueado
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3 w-3" /> Audio Activo
                          </>
                        )}
                      </button>
                    </div>

                    {/* Quick Row Buttons */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {user.linkStatus === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={updatingId === user.id}
                            onClick={() =>
                              void runAction(user.id, '/api/admin/users/update', {
                                userId: user.id,
                                linkStatus: 'approved',
                              })
                            }
                            className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 p-1.5 text-emerald-300 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === user.id}
                            onClick={() =>
                              void runAction(user.id, '/api/admin/users/update', {
                                userId: user.id,
                                linkStatus: 'rejected',
                                rejectionReason: 'Rechazado por moderación.',
                              })
                            }
                            className="rounded-lg bg-red-500/20 border border-red-500/40 p-1.5 text-red-300 cursor-pointer"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {user.robloxUser && (
                        <Link
                          href={`/admin/minecraft?busqueda=${encodeURIComponent(user.robloxUser)}`}
                          title="Gestionar en Minecraft"
                          className="rounded-lg bg-neutral-800 border border-neutral-700 p-1.5 text-gray-300 hover:text-white"
                        >
                          <Gamepad2 className="h-4 w-4" />
                        </Link>
                      )}

                      <Link
                        href={`/admin/usuarios/${encodeURIComponent(user.id)}`}
                        className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-black hover:bg-amber-400"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================= */}
          {/* 2. DESKTOP TABLE VIEW (Visible on screens >= md)         */}
          {/* ========================================================= */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-700/60 bg-[#202226] shadow-md">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-700/60 bg-neutral-900/50 font-bold uppercase tracking-wider text-gray-400">
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={visibleUsers.length > 0 && visibleUsers.every((u) => selectedIds.has(u.id))}
                      onChange={selectAllVisible}
                      className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3">Usuario Roblox</th>
                  <th className="px-3 py-3">Contacto / Cuenta</th>
                  <th className="px-3 py-3">Estado Web</th>
                  <th className="px-3 py-3">Rango Comunidad</th>
                  <th className="px-3 py-3">Soundboard</th>
                  <th className="px-3 py-3 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700/40">
                {visibleUsers.map((user) => {
                  const isSelected = selectedIds.has(user.id);
                  const isOwner = user.email.toLowerCase().includes('milumon') || user.minecraftRank === 'pollito_admin';
                  const isMod = user.minecraftRank === 'pollito_moderador';
                  const isOficial = user.minecraftRank === 'pollito_oficial';

                  return (
                    <tr
                      key={user.id}
                      onClick={() => toggleSelectUser(user.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-white/[.02]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(user.id)}
                          className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* Roblox User & Avatar */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {user.robloxAvatarUrl ? (
                            <img
                              src={user.robloxAvatarUrl}
                              alt={user.robloxDisplayName || user.robloxUser || 'Avatar'}
                              className="h-10 w-10 shrink-0 rounded-xl border border-neutral-700/60 bg-neutral-800 object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-700/60 bg-neutral-800 text-base">
                              🐣
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white text-sm">
                              {user.robloxDisplayName || 'Usuario'}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">
                              @{user.robloxUser || 'sin-roblox'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td className="px-3 py-3 font-medium text-gray-300">
                        <p className="max-w-48 truncate text-[11px]">{user.email}</p>
                        {user.tiktokUser && (
                          <p className="text-[10px] text-gray-400">TikTok: @{user.tiktokUser}</p>
                        )}
                        <p className="text-[9px] text-gray-500 font-mono">ID: {user.id.slice(0, 8)}...</p>
                      </td>

                      {/* Link Status Badge */}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                            user.linkStatus === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : user.linkStatus === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : user.linkStatus === 'rejected'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-neutral-800 text-gray-400 border border-neutral-700'
                          }`}
                        >
                          {user.linkStatus === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                          {user.linkStatus === 'rejected' && <XCircle className="h-3 w-3" />}
                          {getAdminUserStatusLabel(user.linkStatus)}
                        </span>
                      </td>

                      {/* Rank Badge */}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${
                            isOwner
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : isMod
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : isOficial
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isOwner && <Crown className="h-3 w-3 text-red-400" />}
                          {isMod && <Shield className="h-3 w-3 text-purple-400" />}
                          {isOficial && '👑'}
                          {!isOwner && !isMod && !isOficial && '🐣'}
                          {isOwner
                            ? 'Admin / Owner'
                            : isMod
                            ? 'Moderador'
                            : isOficial
                            ? 'Oficial'
                            : 'Invitado'}
                        </span>
                      </td>

                      {/* Soundboard Permission Badge */}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void runAction(user.id, '/api/admin/users/soundboard-toggle', {
                              userId: user.id,
                              disabled: !user.soundboardDisabled,
                            });
                          }}
                          disabled={updatingId === user.id}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            user.soundboardDisabled
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          {user.soundboardDisabled ? (
                            <>
                              <VolumeX className="h-3 w-3" /> Bloqueado
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3" /> Activo
                            </>
                          )}
                        </button>
                      </td>

                      {/* Row Actions */}
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {user.linkStatus === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingId === user.id}
                                onClick={() =>
                                  void runAction(user.id, '/api/admin/users/update', {
                                    userId: user.id,
                                    linkStatus: 'approved',
                                  })
                                }
                                title="Aprobar vinculación"
                                className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 p-1.5 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={updatingId === user.id}
                                onClick={() =>
                                  void runAction(user.id, '/api/admin/users/update', {
                                    userId: user.id,
                                    linkStatus: 'rejected',
                                    rejectionReason: 'Rechazado por moderación.',
                                  })
                                }
                                title="Rechazar vinculación"
                                className="rounded-lg bg-red-500/20 border border-red-500/40 p-1.5 text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}

                          {user.robloxUser && (
                            <Link
                              href={`/admin/minecraft?busqueda=${encodeURIComponent(user.robloxUser)}`}
                              title="Gestionar en Minecraft"
                              className="rounded-lg bg-neutral-800 border border-neutral-700 p-1.5 text-gray-300 hover:text-white hover:bg-neutral-700 transition-colors"
                            >
                              <Gamepad2 className="h-4 w-4" />
                            </Link>
                          )}

                          <Link
                            href={`/admin/usuarios/${encodeURIComponent(user.id)}`}
                            aria-label={`Editar ${user.robloxDisplayName || user.robloxUser || user.email}`}
                            className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-black hover:bg-amber-400 transition-colors shadow-sm"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-neutral-700/60 pt-4 text-xs font-semibold">
              <span className="text-gray-400 text-center sm:text-left">
                Mostrando {(page - 1) * USERS_PER_PAGE + 1} - {Math.min(page * USERS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length} usuarios
              </span>
              <div className="inline-flex justify-center items-center gap-2 rounded-xl border border-neutral-700/60 bg-[#202226] p-1">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={page === 1}
                  onClick={() => navigateToPage(page - 1)}
                  className={`rounded-lg border border-neutral-700/60 bg-[#2b2d31] p-1.5 hover:bg-neutral-700/40 transition-colors disabled:opacity-30 cursor-pointer ${focusClassName}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 font-mono text-[10px] font-bold">
                  PÁG. {page} / {totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Página siguiente"
                  disabled={page === totalPages}
                  onClick={() => navigateToPage(page + 1)}
                  className={`rounded-lg border border-neutral-700/60 bg-[#2b2d31] p-1.5 hover:bg-neutral-700/40 transition-colors disabled:opacity-30 cursor-pointer ${focusClassName}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar - Mobile Optimized */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex w-[94vw] max-w-4xl flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-neutral-700 bg-neutral-900/95 p-3 sm:px-5 sm:py-3.5 shadow-2xl backdrop-blur-md animate-slide-up">
          <div className="flex items-center gap-2 pr-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-black">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-white hidden sm:inline">Seleccionados</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Bulk Approve / Reject */}
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void runBulkAction('approve')}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aprobar
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void runBulkAction('reject', { reason: 'Rechazado por moderación.' })}
              className="flex items-center gap-1 rounded-xl bg-red-600 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
              Rechazar
            </button>

            {/* Bulk Rank Changes */}
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void runBulkAction('set_rank', { rank: 'pollito_oficial' })}
              className="flex items-center gap-1 rounded-xl bg-emerald-500 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              👑 Oficial
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void runBulkAction('set_rank', { rank: 'pollito_moderador' })}
              className="flex items-center gap-1 rounded-xl bg-purple-600 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              🛡️ Mod
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void runBulkAction('set_rank', { rank: 'pollito_invitado' })}
              className="flex items-center gap-1 rounded-xl bg-amber-500 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              🐣 Invitado
            </button>

            {/* Bulk Soundboard Toggle */}
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void runBulkAction('soundboard_enable')}
              title="Habilitar permisos de sonidos y stream"
              className="flex items-center gap-1 rounded-xl bg-neutral-800 border border-neutral-700 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-neutral-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void runBulkAction('soundboard_disable')}
              title="Bloquear permisos de sonidos y stream"
              className="flex items-center gap-1 rounded-xl bg-neutral-800 border border-neutral-700 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-red-400 hover:bg-neutral-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              <VolumeX className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
