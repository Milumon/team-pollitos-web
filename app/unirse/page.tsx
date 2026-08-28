import type { Metadata } from 'next';
import { Suspense } from 'react';
import JoinCommunityPageClient from '@/components/onboarding/JoinCommunityPageClient';

export const metadata: Metadata = {
  title: '🐣 Unirse a la Comunidad | Team Pollito',
  description: 'Elige tu tipo de membresía para ingresar a la comunidad de Milumon y acceder al servidor de Minecraft.',
};

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#111318] flex items-center justify-center text-white">Cargando...</div>}>
      <JoinCommunityPageClient />
    </Suspense>
  );
}
