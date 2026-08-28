import React from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

type TabItem = {
  id: string;
  name: string;
  icon: React.ReactNode;
  onClick: () => void;
};

type NavBarProps = {
  variant: 'tabbar' | 'drawer';
  // Drawer props
  isOpen?: boolean;
  onClose?: () => void;
  scrollToSection?: (section: string) => void;
  session?: Session | null;
  statusInfo?: { is_admin?: boolean } | null;
  onLogin?: () => void;
  onLogout?: () => void;
  // Tabbar props
  tabs?: TabItem[];
  activeTab?: string;
};

export const NavBar: React.FC<NavBarProps> = ({
  variant,
  isOpen = false,
  onClose,
  scrollToSection,
  session = null,
  statusInfo = null,
  onLogin,
  onLogout,
  tabs = [],
  activeTab = '',
}) => {
  if (variant === 'tabbar') {
    return (
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-[#1b1d22]/95 backdrop-blur-sm border-t border-white/5 py-2 px-2 flex items-center justify-around z-50">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                tab.onClick();
                if (onClose) onClose();
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer focus:outline-none ${
                isActive
                  ? 'text-[#FFC200] bg-[#FFC200]/10'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className={`flex items-center justify-center transition-transform ${isActive ? 'scale-105' : ''}`}>
                {tab.icon}
              </div>
              <span className={`text-[9px] font-display font-semibold mt-1 ${isActive ? 'text-[#FFC200]' : 'text-gray-500'}`}>
                {tab.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Drawer variant
  if (!isOpen) return null;

  const username = session?.user?.email?.split('@')[0] || 'Usuario';

  return (
    <div className="hidden max-[1100px]:flex bg-white border-b border-gray-100 px-5 py-4 flex-col gap-1 sticky top-[72px] z-40 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
      {scrollToSection && (
        <>
          {[
            { key: 'inicio', label: 'Inicio' },
            { key: 'beneficios', label: 'Beneficios' },
            { key: 'rankings', label: 'Rankings' },
            { key: 'timeline-ingreso', label: 'Cómo Ingresar' },
            { key: 'reglas-testimonios', label: 'Reglas' },
            { key: 'miembros', label: 'Miembros' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { scrollToSection(key); if (onClose) onClose(); }}
              className="text-left py-2.5 px-2 text-sm font-display font-semibold text-gray-600 hover:text-[#2D3139] hover:bg-gray-50 rounded-lg transition-all cursor-pointer"
            >
              {label}
            </button>
          ))}
          <Link href="/minecraft" className="py-2.5 px-2 text-sm font-display font-semibold text-[#2D3139] hover:bg-[#FFF7DC] rounded-lg decoration-transparent block">
            Minecraft
          </Link>
        </>
      )}

      {!scrollToSection && (
        <>
          <Link href="/" className="py-2.5 px-2 text-sm font-display font-semibold text-gray-600 hover:text-[#2D3139] hover:bg-gray-50 rounded-lg decoration-transparent block">Ir a Inicio</Link>
          <Link href="/panel/inicio" className="py-2.5 px-2 text-sm font-display font-semibold text-gray-600 hover:text-[#2D3139] hover:bg-gray-50 rounded-lg decoration-transparent block">Panel del Miembro</Link>
          {statusInfo?.is_admin && (
            <Link href="/admin/inicio" className="py-2.5 px-2 text-sm font-display font-semibold text-gray-600 hover:text-[#2D3139] hover:bg-gray-50 rounded-lg decoration-transparent block">Panel Admin</Link>
          )}
        </>
      )}

      <div className="h-px bg-gray-100 my-2" />

      <div className="flex flex-col gap-2">
        {session ? (
          <div className="flex flex-col gap-2">
            {statusInfo?.is_admin && (
              <Link
                href="/admin/inicio"
                onClick={() => { if (onClose) onClose(); }}
                className="flex items-center gap-1.5 font-display font-semibold text-xs bg-[#FFC200]/10 text-[#D4A000] border border-[#FFC200]/20 px-3 py-2 rounded-lg decoration-transparent"
              >
                🛡️ Panel Admin
              </Link>
            )}
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden h-10">
              <div className="flex items-center gap-1.5 px-3 flex-1 h-full">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="font-display font-semibold text-xs text-gray-600">
                  ¡Hola, <span className="text-[#D4A000] font-bold">{username}</span>!
                </span>
              </div>
              {onLogout && (
                <button
                  onClick={() => { onLogout(); if (onClose) onClose(); }}
                  className="flex items-center gap-1 px-3 hover:bg-gray-100 text-gray-500 hover:text-red-500 transition-all cursor-pointer h-full border-l border-gray-200 focus:outline-none"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-xs font-display font-semibold">Salir</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          onLogin && (
            <button
              onClick={() => { onLogin(); if (onClose) onClose(); }}
              className="flex items-center justify-center gap-1.5 font-display font-semibold text-sm bg-[#FFC200] hover:brightness-105 text-black py-2.5 rounded-xl active:scale-[0.97] transition-all cursor-pointer"
            >
              🐣 Únete a la Comunidad
            </button>
          )
        )}
      </div>
    </div>
  );
};
