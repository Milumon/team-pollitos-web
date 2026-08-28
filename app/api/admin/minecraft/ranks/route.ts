import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const VALID_RANKS = ['pollito_invitado', 'pollito_oficial', 'pollito_admin'];

export async function GET(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Fetch all profiles safely using select('*')
  let profiles: Array<Record<string, unknown>> = [];
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('*');

  if (profilesError) {
    console.error('[Admin Minecraft ranks GET profiles]:', profilesError.message);
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from('profiles')
      .select('id, roblox_user');
    if (fallbackError) {
      console.error('[Admin Minecraft ranks fallback GET]:', fallbackError.message);
      return NextResponse.json({ error: `Error al consultar perfiles: ${profilesError.message}` }, { status: 500 });
    }
    profiles = (fallbackData as Array<Record<string, unknown>>) ?? [];
  } else {
    profiles = (profilesData as Array<Record<string, unknown>>) ?? [];
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

  const users = profiles.map((p) => {
    const userId = String(p.id || '');
    const robloxUser = String(p.roblox_user || '');
    const robloxDisplayName = String(p.roblox_display_name || robloxUser || 'Usuario');
    const robloxAvatarUrl = typeof p.roblox_avatar_url === 'string' ? p.roblox_avatar_url : null;
    const minecraftRank = typeof p.minecraft_rank === 'string' ? p.minecraft_rank : 'pollito_invitado';
    const isAdmin = Boolean(p.is_admin || p.role === 'admin' || robloxUser.toLowerCase().includes('milumon'));
    const userMinecraftAccounts = accountsByUserId.get(userId) || [];

    return {
      id: userId,
      roblox_user: robloxUser,
      roblox_display_name: robloxDisplayName,
      roblox_avatar_url: robloxAvatarUrl,
      minecraft_rank: minecraftRank,
      is_admin: isAdmin,
      minecraft_accounts: userMinecraftAccounts,
      has_minecraft: userMinecraftAccounts.length > 0,
    };
  });

  users.sort((a, b) => a.roblox_display_name.localeCompare(b.roblox_display_name));

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
    return NextResponse.json({ error: `Error al actualizar el rango: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId, rank });
}
