import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const expectedToken = process.env.MINECRAFT_BRIDGE_TOKEN;
  if (!expectedToken || request.headers.get('x-minecraft-bridge-token') !== expectedToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, roblox_user, minecraft_rank')
    .not('minecraft_rank', 'is', null)
    .order('roblox_user');

  if (error) {
    console.error('[Minecraft ranks GET]:', error.message);
    return NextResponse.json({ error: 'No se pudieron consultar los rangos.' }, { status: 500 });
  }

  const ranks = (data ?? []).map((profile) => ({
    userId: profile.id,
    username: profile.roblox_user,
    rank: profile.minecraft_rank || 'pollito_invitado',
  }));

  return NextResponse.json({ ranks }, { headers: { 'Cache-Control': 'no-store' } });
}
