import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const expectedToken = process.env.MINECRAFT_BRIDGE_TOKEN;
  if (!expectedToken || request.headers.get('x-minecraft-bridge-token') !== expectedToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('minecraft_accounts')
    .select('user_id, edition, username, player_id, status')
    .in('status', ['pending', 'approved'])
    .order('username');

  if (error) {
    console.error('[Minecraft whitelist GET]:', error.message);
    return NextResponse.json({ error: 'No se pudo consultar la whitelist.' }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((account) => account.user_id))];
  const { data: profiles, error: profilesError } = userIds.length === 0
    ? { data: [], error: null }
    : await supabaseAdmin
      .from('profiles')
    .select('id, roblox_display_name, link_status')
    .in('id', userIds);

  if (profilesError) {
    console.error('[Minecraft whitelist profiles GET]:', profilesError.message);
    return NextResponse.json({ error: 'No se pudieron consultar los perfiles.' }, { status: 500 });
  }

  const approvedUserIds = new Set((profiles ?? []).filter((profile) => profile.link_status === 'approved').map((profile) => profile.id));
  const nicknameByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile.roblox_display_name?.trim() || null]));
  const accounts = (data ?? []).filter((account) => approvedUserIds.has(account.user_id)).map((account) => ({
    ...account,
    player_id: account.player_id ?? `pending:${account.username}`,
    nickname: nicknameByUserId.get(account.user_id) ?? null,
    user_id: undefined,
  }));

  return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } });
}
