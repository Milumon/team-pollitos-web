import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export async function POST(request: NextRequest) {
  const expectedToken = process.env.MINECRAFT_BRIDGE_TOKEN;
  if (!expectedToken || request.headers.get('x-minecraft-bridge-token') !== expectedToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { edition?: unknown; playerId?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const edition = body.edition;
  const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

  if ((edition !== 'java' && edition !== 'bedrock') || !playerId || !CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: 'Datos de verificación inválidos.' }, { status: 400 });
  }

  const { data: account, error: lookupError } = await supabaseAdmin
    .from('minecraft_accounts')
    .select('id, user_id, username, status, link_code_expires_at')
    .eq('edition', edition)
    .eq('link_code_hash', createHash('sha256').update(code).digest('hex'))
    .maybeSingle();

  if (lookupError) {
    console.error('[Minecraft link verify lookup]:', lookupError.message);
    return NextResponse.json({ error: 'No se pudo verificar la cuenta.' }, { status: 500 });
  }

  if (!account || !account.link_code_expires_at || new Date(account.link_code_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Código inválido o expirado.' }, { status: 404 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('link_status')
    .eq('id', account.user_id)
    .maybeSingle();

  if (profileError) {
    console.error('[Minecraft link verify profile]:', profileError.message);
    return NextResponse.json({ error: 'No se pudo comprobar la aprobación del usuario.' }, { status: 500 });
  }

  if (profile?.link_status !== 'approved') {
    return NextResponse.json({ error: 'El usuario todavía no es un Miembro Oficial aprobado.' }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('minecraft_accounts')
    .update({ player_id: playerId, verified_at: new Date().toISOString(), status: 'approved', approved_at: new Date().toISOString(), link_code: null, link_code_hash: null, link_code_expires_at: null, updated_at: new Date().toISOString() })
    .eq('id', account.id);

  if (updateError) {
    console.error('[Minecraft link verify update]:', updateError.message);
    return NextResponse.json({ error: 'No se pudo completar la verificación.' }, { status: 500 });
  }

  return NextResponse.json({ verified: true, accountId: account.id, userId: account.user_id, username: account.username });
}
