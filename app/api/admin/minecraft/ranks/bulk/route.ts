import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const VALID_RANKS = ['pollito_invitado', 'pollito_oficial', 'pollito_moderador', 'pollito_admin'];

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { userIds?: unknown; rank?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((id): id is string => typeof id === 'string') : [];
  const rank = typeof body.rank === 'string' ? body.rank.toLowerCase().trim() : '';

  if (userIds.length === 0 || !VALID_RANKS.includes(rank)) {
    return NextResponse.json({ error: 'Usuarios o rango inválido.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ minecraft_rank: rank })
    .in('id', userIds);

  if (error) {
    console.error('[Admin Minecraft bulk ranks update]:', error.message);
    return NextResponse.json({ error: 'Error al actualizar los rangos en lote.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: userIds.length, rank });
}
