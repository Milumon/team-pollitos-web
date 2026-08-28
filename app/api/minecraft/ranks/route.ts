import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const expectedToken = process.env.MINECRAFT_BRIDGE_TOKEN;
  if (!expectedToken || request.headers.get('x-minecraft-bridge-token') !== expectedToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Get active minecraft accounts with their user profiles
  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('minecraft_accounts')
    .select('username, user_id')
    .in('status', ['pending', 'approved']);

  if (accountsError) {
    console.error('[Minecraft ranks GET accounts]:', accountsError.message);
    return NextResponse.json({ error: 'Error al consultar cuentas de Minecraft' }, { status: 500 });
  }

  const userIds = [...new Set((accounts ?? []).map((a) => a.user_id))];
  const { data: profiles, error: profilesError } = userIds.length === 0
    ? { data: [], error: null }
    : await supabaseAdmin
      .from('profiles')
      .select('id, minecraft_rank, is_admin')
      .in('id', userIds);

  if (profilesError) {
    console.error('[Minecraft ranks GET profiles]:', profilesError.message);
    return NextResponse.json({ error: 'Error al consultar perfiles' }, { status: 500 });
  }

  const rankByUserId = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p.minecraft_rank || (p.is_admin ? 'pollito_admin' : 'pollito_invitado')
    ])
  );

  const users = (accounts ?? []).map((account) => ({
    username: account.username,
    rank: rankByUserId.get(account.user_id) || 'pollito_invitado',
  }));

  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
}
