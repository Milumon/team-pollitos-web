import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const VALID_RANKS = ['pollito_invitado', 'pollito_oficial', 'pollito_admin'];

export async function GET(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Fetch all profiles
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, roblox_user, roblox_display_name, roblox_avatar_url, minecraft_rank, role, is_admin, created_at')
    .order('roblox_display_name', { ascending: true });

  if (profilesError) {
    console.error('[Admin Minecraft ranks GET profiles]:', profilesError.message);
    return NextResponse.json({ error: 'Error al consultar perfiles.' }, { status: 500 });
  }

  // Fetch all minecraft accounts
  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('minecraft_accounts')
    .select('id, user_id, username, edition, status, verified_at')
    .in('status', ['pending', 'approved']);

  if (accountsError) {
    console.error('[Admin Minecraft ranks GET accounts]:', accountsError.message);
  }

  const accountsByUserId = new Map<string, Array<{ id: string; username: string; edition: string; status: string }>>();
  (accounts ?? []).forEach((acc) => {
    const list = accountsByUserId.get(acc.user_id) || [];
    list.push({ id: acc.id, username: acc.username, edition: acc.edition, status: acc.status });
    accountsByUserId.set(acc.user_id, list);
  });

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    roblox_user: p.roblox_user,
    roblox_display_name: p.roblox_display_name || p.roblox_user,
    roblox_avatar_url: p.roblox_avatar_url,
    minecraft_rank: p.minecraft_rank || 'pollito_invitado',
    is_admin: p.is_admin || p.role === 'admin',
    minecraft_accounts: accountsByUserId.get(p.id) || [],
    has_minecraft: accountsByUserId.has(p.id) && (accountsByUserId.get(p.id)?.length ?? 0) > 0,
  }));

  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { userId?: unknown; rank?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId : '';
  const rank = typeof body.rank === 'string' ? body.rank.toLowerCase().trim() : '';

  if (!userId || !VALID_RANKS.includes(rank)) {
    return NextResponse.json({ error: 'Usuario o rango inválido.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ minecraft_rank: rank })
    .eq('id', userId);

  if (error) {
    console.error('[Admin Minecraft rank update]:', error.message);
    return NextResponse.json({ error: 'Error al actualizar el rango.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId, rank });
}
