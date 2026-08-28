'use client';

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

        {/* Navigation - Desktop (Always visible) */}
        <nav className={`hidden min-[1101px]:flex items-center gap-1 font-display font-semibold text-sm ${textMuted} ml-8 mr-auto`}>
          {/* Inicio */}
          {scrollToSection ? (
            <button
              onClick={() => scrollToSection('inicio')}
              className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all cursor-pointer text-sm`}
            >
              Inicio
            </button>
          ) : (
            <Link
              href="/"
              className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all decoration-transparent text-sm`}
            >
              Inicio
            </Link>
          )}

          {/* Beneficios */}
          {scrollToSection ? (
            <button
              onClick={() => scrollToSection('beneficios')}
              className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all cursor-pointer text-sm`}
            >
              Beneficios
            </button>
          ) : (
            <Link
              href="/#beneficios"
              className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all decoration-transparent text-sm`}
            >
              Beneficios
            </Link>
          )}

          {/* Rankings */}
          <Link
            href="/clasificaciones"
            className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all decoration-transparent text-sm`}
          >
            Rankings
          </Link>

          {/* Comunidad Dropdown */}
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
                  { key: 'timeline-ingreso', label: 'Cómo ingresar', href: '/#timeline-ingreso' },
                  { key: 'reglas-testimonios', label: 'Reglas', href: '/#reglas-testimonios' },
                  { key: 'miembros', label: 'Miembros', href: '/#miembros' },
                ].map(({ key, label, href }) => (
                  scrollToSection ? (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { scrollToSection(key); setCommunityOpen(false); }}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-[#2D3139]'}`}
                    >
                      {label}
                    </button>
                  ) : (
                    <Link
                      key={key}
                      href={href}
                      onClick={() => setCommunityOpen(false)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-[#2D3139]'}`}
                    >
                      {label}
                    </Link>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Minecraft */}
          <Link
            href="/minecraft"
            className={`${hoverBg} hover:${isDark ? 'text-white' : 'text-[#2D3139]'} whitespace-nowrap px-3 py-2 rounded-lg transition-all decoration-transparent text-sm`}
          >
            Minecraft
          </Link>
        </nav>

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

          {/* User profile / Login */}
          {session ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className={`hidden min-[1101px]:flex items-center gap-2 px-3 py-1.5 rounded-xl font-display font-bold text-xs ${sessionBg} hover:opacity-90 transition-opacity cursor-pointer`}
                aria-expanded={accountOpen}
              >
                <div className="w-6 h-6 rounded-lg bg-[#FFC200] flex items-center justify-center text-xs text-black font-black">
                  {username[0]?.toUpperCase() || 'P'}
                </div>
                <span className="max-w-[120px] truncate">{username}</span>
                <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
              </button>

              {accountOpen && (
                <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl border p-1.5 shadow-[0_12px_30px_rgba(0,0,0,.12)] ${isDark ? 'border-white/10 bg-[#24262b]' : 'border-gray-100 bg-white'}`}>
                  <Link
                    href="/comunidad"
                    onClick={() => setAccountOpen(false)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-[#2D3139]'}`}
                  >
                    Mi Perfil
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin/inicio"
                      onClick={() => setAccountOpen(false)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-[#2D3139]'}`}
                    >
                      Panel de Administración
                    </Link>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => { onLogout(); setAccountOpen(false); }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Cerrar Sesión
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            onLogin && (
              <button
                type="button"
                onClick={onLogin}
                className="hidden min-[1101px]:inline-flex items-center justify-center rounded-xl bg-[#FFC200] px-4 py-2 text-xs font-bold text-black transition-all hover:brightness-105 cursor-pointer"
              >
                Ingresar
              </button>
            )
          )}

          {/* Mobile hamburger button */}
          {showMobileToggle && setIsMobileMenuOpen && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`min-[1101px]:hidden p-2 rounded-xl border ${isDark ? 'border-white/10 text-white' : 'border-gray-200 text-[#2D3139]'} hover:bg-gray-100 transition-colors`}
              aria-label="Abrir menú"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};