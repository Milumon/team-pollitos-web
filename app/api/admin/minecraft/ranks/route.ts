import { NextRequest, NextResponse } from 'next/server';

import { isAuthorized } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const VALID_RANKS = ['pollito_invitado', 'pollito_oficial', 'pollito_admin'];

export async function GET(request: NextRequest) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, roblox_user, roblox_display_name, roblox_avatar_url, link_status, minecraft_rank')
    .order('roblox_display_name');

  if (error) {
    console.error('[Admin Minecraft ranks GET]:', error.message);
    return NextResponse.json({ error: 'No se pudieron consultar los rangos.' }, { status: 500 });
  }

  return NextResponse.json({ profiles: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { userId?: unknown; rank?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId : '';
  const rank = typeof body.rank === 'string' ? body.rank : '';

  if (!userId || !VALID_RANKS.includes(rank)) {
    return NextResponse.json({ error: 'Datos inválidos. Rangos válidos: ' + VALID_RANKS.join(', ') }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ minecraft_rank: rank, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, roblox_user, roblox_display_name, minecraft_rank')
    .maybeSingle();

  if (error) {
    console.error('[Admin Minecraft ranks POST]:', error.message);
    return NextResponse.json({ error: 'No se pudo actualizar el rango.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });

  return NextResponse.json({ profile: data });
}
