import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/serverSession';

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type Edition = 'java' | 'bedrock';

function isEdition(value: unknown): value is Edition {
  return value === 'java' || value === 'bedrock';
}

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

function createLinkCode() {
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.linkStatus !== 'approved') {
    return NextResponse.json({ error: 'Solo los Miembros Oficiales pueden vincular Minecraft.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('minecraft_accounts')
    .select('id, edition, username, player_id, status, rejection_reason, verified_at, approved_at, revoked_at, link_code, link_code_expires_at, created_at, updated_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Minecraft link GET]:', error.message);
    return NextResponse.json({ error: 'No se pudo consultar la vinculación.' }, { status: 500 });
  }

  const accounts = (data ?? []).map((account) => ({
    ...account,
    code: account.link_code_expires_at && new Date(account.link_code_expires_at).getTime() > Date.now() ? account.link_code : null,
    link_code: undefined,
  }));

  return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.linkStatus !== 'approved') {
    return NextResponse.json({ error: 'Solo los Miembros Oficiales pueden vincular Minecraft.' }, { status: 403 });
  }

  let body: { edition?: unknown; username?: unknown; playerId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const edition = body.edition;
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const submittedPlayerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';

  if (!isEdition(edition) || !username || username.length > 32 || submittedPlayerId.length > 100) {
    return NextResponse.json({ error: 'Datos de Minecraft inválidos.' }, { status: 400 });
  }

  const { data: existingAccount, error: existingAccountError } = await supabaseAdmin
    .from('minecraft_accounts')
    .select('id, user_id, status, verified_at, link_code_expires_at')
    .eq('edition', edition)
    .ilike('username', username)
    .neq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (existingAccountError) {
    console.error('[Minecraft link conflict check]:', existingAccountError.message);
    return NextResponse.json({ error: 'No se pudo comprobar ese usuario de Minecraft.' }, { status: 500 });
  }

  if (existingAccount) {
    // A request can be left under another profile when the user changes auth
    // provider. It is safe to recover it before Minecraft verifies the code;
    // verified accounts remain protected by the conflict below.
    if (existingAccount.status === 'pending' && !existingAccount.verified_at) {
      const code = createLinkCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
      const { data, error } = await supabaseAdmin
        .from('minecraft_accounts')
        .update({
          user_id: session.user.id,
          username,
          player_id: `pending:${session.user.id}:${edition}`,
          link_code_hash: hashCode(code),
          link_code: code,
          link_code_expires_at: expiresAt,
          verified_at: null,
          status: 'pending',
          rejection_reason: null,
          approved_by: null,
          approved_at: null,
          revoked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id)
        .select('id, edition, username, player_id, status, rejection_reason, verified_at, link_code, link_code_expires_at, created_at, updated_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'Ya tienes una solicitud de Minecraft para esta edición.' }, { status: 409 });
        }
        console.error('[Minecraft link recovery]:', error.message);
        return NextResponse.json({ error: 'No se pudo recuperar la solicitud anterior.' }, { status: 500 });
      }

      return NextResponse.json({ account: data, code, expiresAt }, { status: 201 });
    }

    return NextResponse.json({ error: 'Esa cuenta de Minecraft ya está vinculada a otro usuario.' }, { status: 409 });
  }

  const playerId = submittedPlayerId || `pending:${session.user.id}:${edition}`;
  const code = createLinkCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('minecraft_accounts')
    .upsert({
      user_id: session.user.id,
      edition,
      username,
      player_id: playerId,
      link_code_hash: hashCode(code),
      link_code: code,
      link_code_expires_at: expiresAt,
      verified_at: null,
      status: 'pending',
      rejection_reason: null,
      approved_by: null,
      approved_at: null,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,edition' })
    .select('id, edition, username, player_id, status, rejection_reason, verified_at, link_code, link_code_expires_at, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Esa cuenta de Minecraft ya está vinculada a otro usuario.' }, { status: 409 });
    }
    console.error('[Minecraft link POST]:', error.message);
    return NextResponse.json({ error: 'No se pudo crear la solicitud.' }, { status: 500 });
  }

  return NextResponse.json({ account: data, code, expiresAt }, { status: 201 });
}
