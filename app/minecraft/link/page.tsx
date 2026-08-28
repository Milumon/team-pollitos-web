import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getServerSession } from '@/lib/serverSession';
import MinecraftLinkForm from '@/components/minecraft/MinecraftLinkForm';

export const metadata: Metadata = {
  title: 'Vincular Minecraft | Team Pollito',
  robots: { index: false, follow: false },
};

export default async function MinecraftLinkPage() {
  const session = await getServerSession();
  if (!session) redirect('/acceso?returnTo=/minecraft/link');
  if (session.linkStatus !== 'approved') redirect('/?minecraft=approval-required');

  return <MinecraftLinkForm />;
}
