'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';

import { Header } from '@/components/ui/Header';
import { supabase } from '@/lib/supabaseClient';

const commandGroups = [
  {
    id: 'claims',
    icon: '🏡',
    title: 'Protege tu casita',
    intro: 'GriefPrevention protege tus construcciones para que nadie las rompa. En el mundo principal, usa una pala de oro para marcar dos esquinas de tu terreno.',
    commands: [
      ['/claimslist', 'Ver tus terrenos reclamados.'],
      ['/trust Nombre', 'Dar permiso completo para construir.'],
      ['/containertrust Nombre', 'Compartir cofres, hornos y contenedores.'],
      ['/accesstrust Nombre', 'Permitir puertas, botones, camas y mecanismos.'],
      ['/untrust Nombre', 'Quitar un permiso.'],
    ],
  },
  {
    id: 'como-entrar',
    icon: '🎮',
    title: 'Cómo entrar',
    intro: 'Elige la edición que usas y sigue el wizard para vincular tu cuenta antes de entrar.',
    commands: [
      ['/link CODIGO', 'Confirmar la vinculación que empezaste en la web.'],
      ['mc.milumon.dev', 'Dirección del servidor para Java y Bedrock (PC, móvil, consola).'],
      ['Team Pollito', 'Nombre del servidor.'],
    ],
  },
  {
    id: 'problemas',
    icon: '❓',
    title: 'Tengo un problema',
    intro: 'Si algo no funciona, mira el mensaje exacto antes de intentar muchas veces.',
    commands: [
      ['/login Contraseña', 'Entrar después de crear tu contraseña.'],
      ['/register Contraseña Contraseña', 'Crear tu contraseña si AuthMe la solicita.'],
      ['/help', 'Ver ayuda disponible dentro del servidor.'],
    ],
  },
];

export default function MinecraftGuidesPage() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  return <div className="min-h-screen bg-[#FDFBF7] text-[#2D3139]"><Header session={session} onLogout={() => void supabase.auth.signOut()} onLogin={() => window.location.assign('/acceso?returnTo=/minecraft/guias')} /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-16"><Link href="/minecraft" className="text-sm font-bold text-[#9A8D70]">← Volver al mundo</Link><header className="mt-8 max-w-3xl"><p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-[#D4A000]">Minecraft · Team Pollito</p><h1 className="mt-3 font-display text-5xl font-black uppercase leading-[.92] sm:text-7xl">Guías del mundo</h1><p className="mt-5 text-lg font-semibold leading-relaxed text-[#64748B]">Lo importante para cuidar tu casita, jugar con amigos y entrar sin perderte.</p></header><div className="mt-10 space-y-6">{commandGroups.map((group) => <section id={group.id} key={group.id} className="scroll-mt-24 rounded-3xl border border-[#E8DFC5] bg-white p-6 shadow-[0_8px_24px_rgba(76,59,18,.07)] sm:p-8"><div className="flex items-center gap-3"><span className="text-4xl" aria-hidden>{group.icon}</span><h2 className="font-display text-3xl font-bold">{group.title}</h2></div><p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-[#64748B]">{group.intro}</p><div className="mt-6 space-y-3">{group.commands.map(([command, explanation]) => <div key={command} className="flex flex-col gap-3 rounded-2xl border border-[#E8DFC5] bg-[#FFFDF5] p-4 sm:flex-row sm:items-center sm:justify-between"><div><code className="font-mono text-sm font-black text-[#8B6B00]">{command}</code><p className="mt-1 text-sm font-medium text-[#64748B]">{explanation}</p></div><button type="button" onClick={() => void navigator.clipboard.writeText(command.startsWith('/') ? command : command.split(' · ')[1] || command)} className="shrink-0 rounded-lg bg-[#FFD500] px-3 py-2 text-xs font-black text-black">Copiar</button></div>)}</div></section>)}</div><section className="mt-8 rounded-3xl border-2 border-[#B9E6A4] bg-[#F4FBEF] p-6 sm:p-8"><h2 className="font-display text-2xl font-bold">Regla de oro 🐣</h2><p className="mt-3 text-sm font-medium leading-relaxed text-[#536B4C]">No desactives GriefPrevention. La protección existe para que tus construcciones sigan siendo tuyas. Da permisos solo a personas de confianza.</p></section></main></div>;
}
