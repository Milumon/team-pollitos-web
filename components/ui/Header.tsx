import React, { useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu, X, Shield, ChevronDown } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

type HeaderProps = {
  session: Session | null;
  isAdmin?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  panelName?: string;
  panelHref?: string;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (open: boolean) => void;
  showMobileToggle?: boolean;
  scrollToSection?: (section: string) => void;
  // Theme: 'light' for public pages, 'dark' for dashboards
  theme?: 'light' | 'dark';
};

export const Header: React.FC<HeaderProps> = ({
  session,
  isAdmin = false,
  onLogin,
  onLogout,
  panelName,
  panelHref,
  isMobileMenuOpen = false,
  setIsMobileMenuOpen,
  showMobileToggle = true,
  scrollToSection,
  theme = 'light',
}) => {
  const username = session?.user?.email?.split('@')[0] || 'Usuario';
  const [communityOpen, setCommunityOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const isDark = theme === 'dark';
  const headerBg = isDark ? 'bg-[#1b1d22]' : 'bg-white/95 backdrop-blur-sm';
  const headerBorder = isDark ? 'border-b border-white/5' : 'border-b border-[#2D3139]/8';
  const textPrimary = isDark ? 'text-white' : 'text-[#2D3139]';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const brandColor = isDark ? 'text-[#FFC200]' : 'text-[#FFC200]';
  const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const sessionBg = isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200/80';

  return (
    <header className={`${headerBg} ${headerBorder} px-5 md:px-8 sticky top-0 z-50 ${textPrimary} w-full`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center h-[72px]">
        {/* Logo and Name */}
        <Link href="/" className="flex items-center gap-2.5 w-[220px] shrink-0 text-left decoration-transparent group">
          <span className="text-2xl shrink-0 group-hover:scale-105 transition-transform duration-150">🐣</span>
          <span className={`font-display font-bold text-base tracking-tight ${brandColor} leading-none whitespace-nowrap`}>
            Milumon Community
          </span>
        </Link>

        {/* Navigation - Desktop */}
        {scrollToSection && (
          <nav className={`hidden min-[1101px]:flex items-center gap-1 font-display font-semibold text-sm ${textMuted} ml-8 mr-auto`}>
            {[
              { key: 'inicio', label: 'Inicio' },
              { key: 'beneficios', label: 'Beneficios' },
              { key: 'rankings', label: 'Rankings' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => scrollToSection(key)}
                className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all cursor-pointer text-sm`}
              >
                {label}
              </button>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCommunityOpen((open) => !open)}
                className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} flex items-center gap-1 whitespace-nowrap px-3 py-2 rounded-lg transition-all cursor-pointer text-sm`}
                aria-expanded={communityOpen}
              >
                Comunidad
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${communityOpen ? 'rotate-180' : ''}`} />
              </button>
              {communityOpen && (
                <div className={`absolute left-0 top-full mt-2 w-44 rounded-xl border p-1.5 shadow-[0_12px_30px_rgba(0,0,0,.12)] ${isDark ? 'border-white/10 bg-[#24262b]' : 'border-gray-100 bg-white'}`}>
                  {[
                    { key: 'timeline-ingreso', label: 'Cómo ingresar' },
                    { key: 'reglas-testimonios', label: 'Reglas' },
                    { key: 'miembros', label: 'Miembros' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { scrollToSection(key); setCommunityOpen(false); }}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-[#2D3139]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/minecraft"
              className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all decoration-transparent text-sm`}
            >
              Minecraft
            </Link>
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0 ml-6">
          {/* Panel badge */}
          {panelName && panelHref && (
            <Link
              href={panelHref}
              className={`hidden min-[1101px]:flex items-center gap-1.5 font-display font-semibold text-xs px-3 py-2 rounded-lg transition-all decoration-transparent ${
                isDark
                  ? 'bg-[#FFC200]/10 text-[#FFC200] hover:bg-[#FFC200]/15 border border-[#FFC200]/15'
                  : 'bg-[#FFC200]/10 text-[#D4A000] hover:bg-[#FFC200]/15 border border-[#FFC200]/20'
              }`}
            >
              <Shield className="w-3 h-3" />
              {panelName}
            </Link>
          )}

          {/* Admin panel access badge for desktop admins */}
          {isAdmin && !panelName && (
            <Link
              href="/admin/inicio"
              className={`hidden min-[1101px]:flex items-center gap-1.5 font-display font-semibold text-xs px-3 py-2 rounded-lg transition-all decoration-transparent ${
                isDark
                  ? 'bg-[#FFC200]/10 text-[#FFC200] hover:bg-[#FFC200]/15 border border-[#FFC200]/15'
                  : 'bg-[#FFC200]/10 text-[#D4A000] hover:bg-[#FFC200]/15 border border-[#FFC200]/20'
              }`}
            >
              <Shield className="w-3 h-3" />
              Admin
            </Link>
          )}

          {/* Desktop User Session */}
          <div className="hidden min-[1101px]:flex items-center relative">
            {session ? (
              <>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${sessionBg} ${hoverBg}`}
                  aria-expanded={accountOpen}
                >
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0" />
                  <span className={`font-display font-semibold text-xs ${textMuted} whitespace-nowrap`}>{username}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountOpen && (
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl border p-1.5 shadow-[0_12px_30px_rgba(0,0,0,.12)] ${isDark ? 'border-white/10 bg-[#24262b]' : 'border-gray-100 bg-white'}`}>
                    <div className={`px-3 py-2 text-xs font-semibold ${isDark ? 'text-white' : 'text-[#2D3139]'}`}>🟢 {username}</div>
                    <div className={`my-1 h-px ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} />
                    <Link href="/panel/perfil" onClick={() => setAccountOpen(false)} className={`block rounded-lg px-3 py-2 text-xs ${isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>Mi perfil</Link>
                    {onLogout && (
                      <button type="button" onClick={onLogout} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${isDark ? 'text-gray-300 hover:bg-white/5 hover:text-red-400' : 'text-gray-600 hover:bg-gray-50 hover:text-red-500'}`}>
                        <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              onLogin && (
                <button
                  onClick={onLogin}
                  className="flex items-center gap-1.5 font-display font-semibold text-sm bg-[#FFC200] hover:brightness-105 text-black px-4 py-1.5 rounded-xl transition-all cursor-pointer active:scale-[0.97]"
                >
                  🐣 Únete
                </button>
              )
            )}
          </div>

          {/* Mobile hamburger */}
          {showMobileToggle && setIsMobileMenuOpen && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`min-[1101px]:hidden p-1.5 rounded-lg transition-all cursor-pointer focus:outline-none ${
                isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
