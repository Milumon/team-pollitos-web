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
  UserCheck,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  UserX
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';

import { adminFetch, readApiPayload } from './adminApi';
import { useAdminUsers } from './AdminUsersProvider';
import { getAdminUserStatusLabel, type AdminUser } from './types';

const USERS_PER_PAGE = 15;
const focusClassName = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC200] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1f22]';

type FilterTab = 'all' | 'approved' | 'pending' | 'unlinked' | 'rejected' | 'staff' | 'official' | 'guest';
type SortField = 'user' | 'email' | 'status' | 'rank' | 'soundboard';
type SortDirection = 'asc' | 'desc';

export function AdminUsersList() {
  const { users, loading, error, refresh } = useAdminUsers();
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const search = searchParams?.get('busqueda') || '';
  const deferredSearch = useDeferredValue(search);
  const requestedPage = Number(searchParams?.get('pagina'));

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('user');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminUser | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Tab Filtering & Search
  const filteredUsers = useMemo(() => {
    let result = users;

    if (activeTab === 'approved') {
      result = result.filter((u) => u.linkStatus === 'approved');
    } else if (activeTab === 'pending') {
      result = result.filter((u) => u.linkStatus === 'pending');
    } else if (activeTab === 'unlinked') {
      result = result.filter((u) => u.linkStatus !== 'approved' && u.linkStatus !== 'pending' && u.linkStatus !== 'rejected');
    } else if (activeTab === 'rejected') {
      result = result.filter((u) => u.linkStatus === 'rejected');
    } else if (activeTab === 'staff') {
      result = result.filter((u) => u.minecraftRank === 'pollito_admin' || u.minecraftRank === 'pollito_moderador' || (u.isAdmin && u.minecraftRank !== 'pollito_oficial' && u.minecraftRank !== 'pollito_invitado'));
    } else if (activeTab === 'official') {
      result = result.filter((u) => u.minecraftRank === 'pollito_oficial' && u.linkStatus === 'approved');
    } else if (activeTab === 'guest') {
      result = result.filter((u) => (u.minecraftRank === 'pollito_invitado' || !u.minecraftRank) && u.linkStatus === 'approved');
    }

    const needle = deferredSearch.trim().toLowerCase();
    if (needle) {
      result = result.filter((user) =>
        [user.email, user.robloxUser ?? '', user.robloxDisplayName ?? '', user.tiktokUser ?? '', user.id]
          .some((value) => value.toLowerCase().includes(needle)),
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'user') {
        const nameA = (a.robloxDisplayName || a.robloxUser || a.email).toLowerCase();
        const nameB = (b.robloxDisplayName || b.robloxUser || b.email).toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'email') {
        comparison = a.email.toLowerCase().localeCompare(b.email.toLowerCase());
      } else if (sortField === 'status') {
        const order: Record<string, number> = { approved: 1, pending: 2, unlinked: 3, rejected: 4 };
        const rankA = order[a.linkStatus] ?? 99;
        const rankB = order[b.linkStatus] ?? 99;
        comparison = rankA - rankB;
      } else if (sortField === 'rank') {
        const rankOrder: Record<string, number> = { pollito_admin: 1, pollito_moderador: 2, pollito_oficial: 3, pollito_invitado: 4 };
        const rA = a.minecraftRank ? (rankOrder[a.minecraftRank] ?? 5) : 5;
        const rB = b.minecraftRank ? (rankOrder[b.minecraftRank] ?? 5) : 5;
        comparison = rA - rB;
      } else if (sortField === 'soundboard') {
        const sbA = a.soundboardDisabled ? 1 : 0;
        const sbB = b.soundboardDisabled ? 1 : 0;
        comparison = sbA - sbB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [activeTab, deferredSearch, users, sortField, sortDirection]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: users.length,
      approved: users.filter((u) => u.linkStatus === 'approved').length,
      pending: users.filter((u) => u.linkStatus === 'pending').length,
      unlinked: users.filter((u) => u.linkStatus !== 'approved' && u.linkStatus !== 'pending' && u.linkStatus !== 'rejected').length,
      rejected: users.filter((u) => u.linkStatus === 'rejected').length,
      staff: users.filter((u) => u.minecraftRank === 'pollito_admin' || u.minecraftRank === 'pollito_moderador' || (u.isAdmin && u.minecraftRank !== 'pollito_oficial' && u.minecraftRank !== 'pollito_invitado')).length,
      official: users.filter((u) => u.minecraftRank === 'pollito_oficial' && u.linkStatus === 'approved').length,
      guest: users.filter((u) => (u.minecraftRank === 'pollito_invitado' || !u.minecraftRank) && u.linkStatus === 'approved').length,
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

  // Delete Single User
  const handleDeleteSingle = async (userId: string) => {
    setUpdatingId(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await adminFetch('/api/admin/users/bulk', {
        method: 'POST',
        body: JSON.stringify({ userIds: [userId], action: 'delete' }),
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(String(payload.error || 'No se pudo eliminar el usuario'));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      await refresh();
      setActionSuccess('Usuario eliminado permanentemente');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar usuario');
    } finally {
      setUpdatingId(null);
      setDeleteConfirmUser(null);
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
      if (!response.ok) throw new Error(String(payload.error || 'No se pudo ejecutar la acción masiva'));
      setSelectedIds(new Set());
      await refresh();
      setActionSuccess(String(payload.message || 'Acción masiva aplicada exitosamente'));
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error en la acción masiva');
    } finally {
      setBulkLoading(false);
      setShowBulkDeleteModal(false);
    }
  };

  const getRankBadge = (u: AdminUser) => {
    if (u.isAdmin || u.minecraftRank === 'pollito_admin') {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 shadow-sm">
          <Crown className="w-3 h-3 text-amber-400" /> Admin / Owner
        </span>
      );
    }
    if (u.minecraftRank === 'pollito_moderador') {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-300 shadow-sm">
          <Shield className="w-3 h-3 text-blue-400" /> Moderador 🛡️
        </span>
      );
    }
    if (u.minecraftRank === 'pollito_oficial') {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-bold text-yellow-300 shadow-sm">
          👑 Oficial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#35373d] border border-neutral-700/60 px-2 py-0.5 text-[10px] font-bold text-gray-300 shadow-sm">
        🐣 Invitado
      </span>
    );
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity inline ml-1" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-[#FFC200] inline ml-1" />
      : <ArrowDown className="w-3.5 h-3.5 text-[#FFC200] inline ml-1" />;
  };

  return (
    <div className="space-y-5 animate-fade-in relative pb-24">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#FFC200]">Padrón de Miembros</span>
          <h1 className="font-display text-2xl font-bold text-white mt-0.5">Gestión de Usuarios</h1>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Administra perfiles de Roblox, estado de vinculación, rangos unificados y permisos.
          </p>
        </div>

        <div className="relative min-w-[280px] lg:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar usuario, display, email..."
            defaultValue={search}
            onChange={(e) => {
              const val = e.target.value;
              const params = new URLSearchParams(searchParams?.toString() ?? '');
              if (val) params.set('busqueda', val);
              else params.delete('busqueda');
              params.delete('pagina');
              const q = params.toString();
              window.history.pushState(null, '', q ? `${pathname}?${q}` : pathname);
            }}
            className={`w-full bg-[#1e1f22] border border-neutral-700/60 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 transition-colors ${focusClassName}`}
          />
        </div>
      </div>

      {/* Tabs & Multi-Select Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-neutral-700/40 pb-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => { setActiveTab('all'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            Todos ({tabCounts.all})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('approved'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'approved'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            Aprobados ({tabCounts.approved})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('pending'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            Pendientes ({tabCounts.pending})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('unlinked'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'unlinked'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-amber-400 hover:bg-[#35373d]'
            }`}
            title="Usuarios registrados con Google pero que nunca vincularon Roblox"
          >
            Sin verificar ({tabCounts.unlinked})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('rejected'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'rejected'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            Rechazados ({tabCounts.rejected})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('staff'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'staff'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            Staff / Mod ({tabCounts.staff})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('official'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'official'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            Oficiales ({tabCounts.official})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('guest'); navigateToPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'guest'
                ? 'bg-[#FFC200] text-black shadow-sm'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white hover:bg-[#35373d]'
            }`}
          >
            Invitados ({tabCounts.guest})
          </button>
        </div>

        {/* Multi-Select Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={selectAllVisible}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2b2d31] border border-neutral-700/60 text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >
            {selectedIds.size === visibleUsers.length && visibleUsers.length > 0 ? (
              <CheckSquare className="w-3.5 h-3.5 text-[#FFC200]" />
            ) : (
              <Square className="w-3.5 h-3.5 text-gray-500" />
            )}
            Página ({visibleUsers.length})
          </button>
          <button
            type="button"
            onClick={selectAllFiltered}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2b2d31] border border-neutral-700/60 text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >
            {selectedIds.size === filteredUsers.length && filteredUsers.length > 0 ? (
              <CheckSquare className="w-3.5 h-3.5 text-[#FFC200]" />
            ) : (
              <Square className="w-3.5 h-3.5 text-gray-500" />
            )}
            Filtrados ({filteredUsers.length})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {(actionError || error) && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{actionError || error}</span>
        </div>
      )}

      {/* Users List Body */}
      {loading ? (
        <div className="py-20 text-center text-xs font-bold uppercase tracking-wider text-gray-500 animate-pulse">
          Cargando usuarios...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-16 text-center bg-[#2b2d31] border border-dashed border-neutral-700/60 rounded-2xl p-6">
          <p className="text-white font-bold text-sm">No se encontraron usuarios</p>
          <p className="text-xs text-gray-400 mt-1 font-medium">Prueba cambiando de pestaña o término de búsqueda.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto bg-[#2b2d31] border border-neutral-700/60 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,.25)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-700/60 text-gray-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={visibleUsers.length > 0 && visibleUsers.every((u) => selectedIds.has(u.id))}
                      onChange={selectAllVisible}
                      className="rounded border-neutral-700 bg-[#1e1f22] text-[#FFC200] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer group hover:text-white transition-colors"
                    onClick={() => toggleSort('user')}
                  >
                    Usuario Roblox {renderSortIcon('user')}
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer group hover:text-white transition-colors"
                    onClick={() => toggleSort('email')}
                  >
                    Contacto / Cuenta {renderSortIcon('email')}
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer group hover:text-white transition-colors"
                    onClick={() => toggleSort('status')}
                  >
                    Estado Web {renderSortIcon('status')}
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer group hover:text-white transition-colors"
                    onClick={() => toggleSort('rank')}
                  >
                    Rango Comunidad {renderSortIcon('rank')}
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer group hover:text-white transition-colors"
                    onClick={() => toggleSort('soundboard')}
                  >
                    Soundboard {renderSortIcon('soundboard')}
                  </th>
                  <th className="py-3 px-4 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/20">
                {visibleUsers.map((u) => {
                  const isSelected = selectedIds.has(u.id);
                  const isBusy = updatingId === u.id || bulkLoading;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-[#35373d]/40 transition-colors ${
                        isSelected ? 'bg-[#FFC200]/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-neutral-700 bg-[#1e1f22] text-[#FFC200] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Roblox User & Avatar */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl border border-neutral-700/60 bg-[#1e1f22] overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                            {u.robloxAvatarUrl ? (
                              <img
                                src={u.robloxAvatarUrl}
                                alt={u.robloxUser || 'Avatar'}
                                className="w-full h-full object-cover"
                                style={{ transform: 'scale(1.4) translateY(-5%)' }}
                              />
                            ) : (
                              <span className="text-base">🐣</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-white truncate text-xs">
                              {u.robloxDisplayName || 'Usuario'}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-medium truncate">
                              @{u.robloxUser || 'sin-roblox'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact / Email */}
                      <td className="py-3 px-3 text-gray-300">
                        <p className="font-medium truncate max-w-[180px]" title={u.email}>{u.email}</p>
                        {u.tiktokUser && (
                          <p className="text-[10px] text-gray-400 truncate">TikTok: @{u.tiktokUser}</p>
                        )}
                        <p className="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-[120px]">ID: {u.id.slice(0, 8)}...</p>
                      </td>

                      {/* Web Link Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border shadow-sm ${
                            u.linkStatus === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : u.linkStatus === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : u.linkStatus === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-neutral-700/30 text-gray-400 border-neutral-700/50'
                          }`}
                        >
                          {u.linkStatus === 'approved' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : u.linkStatus === 'rejected' ? (
                            <XCircle className="w-3 h-3" />
                          ) : null}
                          {getAdminUserStatusLabel(u.linkStatus)}
                        </span>
                      </td>

                      {/* Rank Badge */}
                      <td className="py-3 px-3">
                        {getRankBadge(u)}
                      </td>

                      {/* Soundboard Permissions */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                            u.soundboardDisabled
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {u.soundboardDisabled ? (
                            <VolumeX className="w-3 h-3 text-red-400" />
                          ) : (
                            <Volume2 className="w-3 h-3 text-emerald-400" />
                          )}
                          {u.soundboardDisabled ? 'Bloqueado' : 'Activo'}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Soundboard Toggle */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(u.id, '/api/admin/users/soundboard-toggle', {
                                userId: u.id,
                                disabled: !u.soundboardDisabled,
                              })
                            }
                            className={`p-1.5 rounded-xl border transition-colors ${
                              u.soundboardDisabled
                                ? 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25'
                                : 'bg-[#1e1f22] text-gray-400 border-neutral-700/60 hover:text-white hover:bg-[#35373d]'
                            }`}
                            title={u.soundboardDisabled ? 'Habilitar soundboard' : 'Bloquear soundboard'}
                          >
                            {u.soundboardDisabled ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                          </button>

                          {/* Link to Minecraft Panel */}
                          <Link
                            href="/admin/minecraft"
                            className="p-1.5 rounded-xl bg-[#1e1f22] text-gray-400 border border-neutral-700/60 hover:text-[#FFC200] hover:bg-[#35373d] transition-colors"
                            title="Gestionar Rango de Minecraft"
                          >
                            <Gamepad2 className="w-3.5 h-3.5" />
                          </Link>

                          {/* Edit Details */}
                          <Link
                            href={`/admin/usuarios/${u.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FFC200] text-black font-bold text-xs hover:brightness-105 transition-all shadow-sm"
                          >
                            <Edit3 className="w-3 h-3" /> Editar
                          </Link>

                          {/* Delete User */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteConfirmUser(u)}
                            className="p-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {visibleUsers.map((u) => {
              const isSelected = selectedIds.has(u.id);
              const isBusy = updatingId === u.id || bulkLoading;

              return (
                <div
                  key={u.id}
                  className={`bg-[#2b2d31] border rounded-2xl p-4 space-y-3 shadow-md transition-all ${
                    isSelected ? 'border-[#FFC200] bg-[#FFC200]/5' : 'border-neutral-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectUser(u.id)}
                        className="rounded border-neutral-700 bg-[#1e1f22] text-[#FFC200] focus:ring-0 cursor-pointer h-4 w-4 shrink-0"
                      />
                      <div className="w-10 h-10 rounded-xl border border-neutral-700/60 bg-[#1e1f22] overflow-hidden shrink-0 flex items-center justify-center">
                        {u.robloxAvatarUrl ? (
                          <img
                            src={u.robloxAvatarUrl}
                            alt={u.robloxUser || 'Avatar'}
                            className="w-full h-full object-cover"
                            style={{ transform: 'scale(1.4) translateY(-5%)' }}
                          />
                        ) : (
                          <span className="text-base">🐣</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white truncate text-xs">
                          {u.robloxDisplayName || 'Usuario'}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-medium truncate">
                          @{u.robloxUser || 'sin-roblox'}
                        </p>
                      </div>
                    </div>

                    <div>{getRankBadge(u)}</div>
                  </div>

                  <div className="text-[11px] text-gray-300 space-y-1 bg-[#1e1f22] p-2.5 rounded-xl border border-neutral-700/40">
                    <p className="truncate font-medium">{u.email}</p>
                    {u.tiktokUser && <p className="text-gray-400">TikTok: @{u.tiktokUser}</p>}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-700/40 text-[10px]">
                      <span className="text-gray-500">Estado:</span>
                      <span className={`font-bold ${u.linkStatus === 'approved' ? 'text-emerald-400' : u.linkStatus === 'pending' ? 'text-amber-400' : 'text-gray-400'}`}>
                        {getAdminUserStatusLabel(u.linkStatus)}
                      </span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-500">Botonera:</span>
                      <span className={`font-bold ${u.soundboardDisabled ? 'text-red-400' : 'text-emerald-400'}`}>
                        {u.soundboardDisabled ? 'Bloqueada' : 'Activa'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          runAction(u.id, '/api/admin/users/soundboard-toggle', {
                            userId: u.id,
                            disabled: !u.soundboardDisabled,
                          })
                        }
                        className={`p-2 rounded-xl border transition-colors ${
                          u.soundboardDisabled
                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                            : 'bg-[#1e1f22] text-gray-400 border-neutral-700/60'
                        }`}
                        title="Botonera"
                      >
                        {u.soundboardDisabled ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      <Link
                        href="/admin/minecraft"
                        className="p-2 rounded-xl bg-[#1e1f22] text-gray-400 border border-neutral-700/60 hover:text-[#FFC200]"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeleteConfirmUser(u)}
                        className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <Link
                      href={`/admin/usuarios/${u.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FFC200] text-black font-bold text-xs hover:brightness-105 shadow-sm"
                    >
                      <Edit3 className="w-3 h-3" /> Editar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-700/60 pt-4 text-xs font-semibold">
              <span className="text-gray-400">
                Mostrando <strong className="text-white">{(page - 1) * USERS_PER_PAGE + 1}</strong> - <strong className="text-white">{Math.min(page * USERS_PER_PAGE, filteredUsers.length)}</strong> de <strong className="text-white">{filteredUsers.length}</strong>
              </span>

              <div className="inline-flex items-center gap-1.5 bg-[#2b2d31] border border-neutral-700/60 p-1 rounded-2xl">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => navigateToPage(page - 1)}
                  className="p-1.5 hover:bg-neutral-800 text-white rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono font-bold text-white text-[10px]">
                  PÁG {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => navigateToPage(page + 1)}
                  className="p-1.5 hover:bg-neutral-800 text-white rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl bg-[#1e1f22]/95 backdrop-blur-md border border-[#FFC200]/40 rounded-2xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-[#FFC200] text-black font-extrabold text-xs">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-white">Seleccionado(s)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Aprobar */}
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => runBulkAction('approve')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-bold transition-all disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" /> Aprobar
            </button>

            {/* Asignar Rango Dropdown */}
            <div className="flex items-center gap-1 bg-[#2b2d31] border border-neutral-700/60 rounded-xl px-2 py-1">
              <Sparkles className="w-3.5 h-3.5 text-[#FFC200]" />
              <select
                aria-label="Asignar Rango Masivo"
                defaultValue=""
                disabled={bulkLoading}
                onChange={(e) => {
                  if (e.target.value) {
                    void runBulkAction('set_rank', { rank: e.target.value });
                    e.target.value = '';
                  }
                }}
                className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
              >
                <option value="" disabled className="bg-[#2b2d31] text-gray-400">Rango Masivo...</option>
                <option value="pollito_oficial" className="bg-[#2b2d31] text-yellow-300">👑 Pollito Oficial</option>
                <option value="pollito_invitado" className="bg-[#2b2d31] text-gray-300">🐣 Pollito Invitado</option>
                <option value="pollito_moderador" className="bg-[#2b2d31] text-blue-300">🛡️ Pollito Moderador</option>
                <option value="pollito_admin" className="bg-[#2b2d31] text-amber-400">👑 Admin / Owner</option>
              </select>
            </div>

            {/* Botonera */}
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => runBulkAction('soundboard_enable')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#2b2d31] border border-neutral-700/60 text-gray-300 hover:text-white text-xs font-bold transition-colors disabled:opacity-50"
              title="Habilitar soundboard a todos los seleccionados"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => runBulkAction('soundboard_disable')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#2b2d31] border border-neutral-700/60 text-gray-300 hover:text-white text-xs font-bold transition-colors disabled:opacity-50"
              title="Bloquear soundboard a todos los seleccionados"
            >
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            </button>

            {/* Eliminar Masivo */}
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-xs font-bold transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>

            {/* Deseleccionar */}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 rounded-xl bg-[#2b2d31] text-gray-400 hover:text-white text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Eliminación Individual */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#2b2d31] border border-neutral-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white">¿Eliminar este usuario?</h3>
                <p className="text-xs text-gray-400">Esta acción es permanente y no se puede deshacer.</p>
              </div>
            </div>

            <div className="p-3 bg-[#1e1f22] rounded-xl border border-neutral-700/60 text-xs space-y-1">
              <p className="font-bold text-white">
                {deleteConfirmUser.robloxDisplayName || deleteConfirmUser.robloxUser || 'Usuario'}
              </p>
              <p className="text-gray-400 font-mono text-[11px]">{deleteConfirmUser.email}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-xl bg-[#35373d] text-gray-300 hover:text-white text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSingle(deleteConfirmUser.id)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-sm"
              >
                Sí, Eliminar Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Eliminación Masiva */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#2b2d31] border border-neutral-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white">¿Eliminar {selectedIds.size} usuarios seleccionados?</h3>
                <p className="text-xs text-gray-400">Se eliminarán permanentemente sus perfiles y vinculaciones.</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Esta acción eliminará de forma definitiva a los <strong>{selectedIds.size}</strong> usuarios seleccionados de la base de datos.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-[#35373d] text-gray-300 hover:text-white text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void runBulkAction('delete')}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-sm"
              >
                Confirmar Eliminación Masiva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
