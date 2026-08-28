'use client';

import { LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { AdminHeader } from './AdminHeader';

const navigation = [
  { href: '/admin/inicio', label: 'Inicio', icon: '📊' },
  { href: '/admin/usuarios', label: 'Usuarios', icon: '👑' },
  { href: '/admin/postulaciones', label: 'Postulaciones', icon: '📝' },
  { href: '/admin/testimonios', label: 'Testimonios', icon: '💬' },
  { href: '/admin/clasificaciones', label: 'Clasificaciones', icon: '🎵' },
  { href: '/admin/agenda', label: 'Agenda', icon: '📅' },
  { href: '/admin/nominados', label: 'Nominados', icon: '👥' },
  { href: '/admin/votos', label: 'Votos', icon: '📊' },
  { href: '/admin/transmision', label: 'Transmisión', icon: '📺' },
  { href: '/admin/overlay', label: 'Overlay', icon: '🎨' },
  { href: '/admin/chat-overlay', label: 'Chat TikTok', icon: '💬' },
  { href: '/admin/sonidos', label: 'Sonidos', icon: '🔊' },
  { href: '/admin/multimedia', label: 'Multimedia', icon: '🖼️' },
  { href: '/admin/estado-transmision', label: 'Estado de transmisión', icon: '📡' },
  { href: '/admin/minecraft', label: 'Minecraft', icon: '⛏️' },
];

const legacyShellRoutes = new Set([
  '/admin/inicio',
  '/admin/usuarios',
  '/admin/operaciones',
  '/admin/postulaciones',
  '/admin/testimonios',
  '/admin/clasificaciones',
  '/admin/agenda',
  '/admin/nominados',
  '/admin/votos',
  '/admin/transmision',
  '/admin/overlay',
  '/admin/chat-overlay',
  '/admin/minecraft',
  '/admin/sonidos',
  '/admin/multimedia',
  '/admin/estado-transmision',
]);

export function AdminShell({
  adminEmail,
  children,
}: Readonly<{ adminEmail: string; children: React.ReactNode }>) {
  const pathname = usePathname() || '';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (legacyShellRoutes.has(pathname)) {
    return children;
  }

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.assign('/');
  };

  const sidebar = (
    <>
      <div>
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Comunidad
        </p>
        <nav aria-label="Panel de Control" className="space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-xl border border-neutral-700/60 px-3 py-2.5 font-display text-sm font-semibold transition-all hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC200] focus-visible:ring-offset-2 focus-visible:ring-offset-[#24262b] ${
                  active
                    ? 'bg-[#FFC200]/10 text-[#FFC200] border-[#FFC200]/50'
                    : 'bg-[#1b1d22] text-gray-300 hover:text-white'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto space-y-2 border-t border-neutral-700/60 pt-4">
        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-xl border border-neutral-700/60 bg-white/5 py-2 font-display text-sm font-semibold text-gray-300 hover:bg-neutral-700/40 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC200] focus-visible:ring-offset-2 focus-visible:ring-offset-[#24262b]"
        >
          Volver al inicio
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-700/60 bg-red-500/10 py-2 font-display text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC200] focus-visible:ring-offset-2 focus-visible:ring-offset-[#24262b]"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#1e1f22] font-sans text-gray-200 antialiased">
      <AdminHeader
        adminEmail={adminEmail}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen((open) => !open)}
      />

      <div className="flex flex-1">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-neutral-700/60 bg-[#24262b] p-4 shadow-[4px_0_12px_rgba(0,0,0,.15)] lg:flex">
          {sidebar}
        </aside>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar navegación"
              className="absolute inset-0 bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD500]"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative flex h-full w-[260px] flex-col border-r border-neutral-700/60 bg-[#24262b] p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-neutral-700/60 pb-4">
                <span className="text-xs font-semibold text-gray-400">Navegación</span>
                <button
                  type="button"
                  aria-label="Cerrar navegación"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg border border-neutral-700/60 bg-white/5 p-1.5 text-gray-200 hover:bg-neutral-700/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC200]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
