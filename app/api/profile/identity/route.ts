import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tagRobloxUser } from '@/lib/robloxAdmin';
import { isValidMemberDisplayName } from '@/lib/memberDisplayName';

const DEFAULT_NAME = (robloxUser: string) => `🐣 ${robloxUser} 🐣`;
const TIKTOK_PATTERN = /^[a-zA-Z0-9._]{1,24}$/;

async function getUser(request: NextRequest) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(authorization.slice('Bearer '.length));
  return user ?? null;
}

function friendlyRobloxError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('"code":3') && message.toLowerCase().includes('not a friend')) {
    return 'No tienes agregado a MilumonRT como amigo en Roblox. Agrégalo y vuelve a intentarlo.';
  }
  return 'No se pudo aplicar tu Nombre Oficial en Roblox. Intenta nuevamente en unos minutos.';
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Sesión no válida o expirada.' }, { status: 401 });

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('link_status, roblox_user, roblox_user_id, roblox_display_name, roblox_avatar_url, tiktok_user, declared_minecraft_username, identity_confirmed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo cargar tu identidad.' }, { status: 500 });
  if (!profile || profile.link_status !== 'approved') {
    return NextResponse.json({ error: 'Solo los Miembros Oficiales pueden confirmar su identidad.' }, { status: 403 });
  }

  return NextResponse.json({
    identity: {
      ...profile,
      suggested_display_name: DEFAULT_NAME(profile.roblox_user || 'Pollito'),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Sesión no válida o expirada.' }, { status: 401 });

  let body: { displayName?: unknown; tiktokUser?: unknown; minecraftUsername?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const tiktokUser = typeof body.tiktokUser === 'string' ? body.tiktokUser.trim().replace(/^@/, '').toLowerCase() : '';
  const minecraftUsername = typeof body.minecraftUsername === 'string' ? body.minecraftUsername.trim() : '';

  if (!isValidMemberDisplayName(displayName)) {
    return NextResponse.json({ error: 'El Nombre Oficial debe tener entre 3 y 15 caracteres y solo puede usar letras, números, espacios y un guion bajo en posición intermedia.' }, { status: 400 });
  }
  if (!tiktokUser || !TIKTOK_PATTERN.test(tiktokUser)) {
    return NextResponse.json({ error: 'Escribe un usuario de TikTok válido.' }, { status: 400 });
  }
  if (minecraftUsername.length > 32) {
    return NextResponse.json({ error: 'El usuario de Minecraft no puede superar los 32 caracteres.' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('link_status, roblox_user_id, roblox_user, roblox_display_name, is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.link_status !== 'approved' || !profile.roblox_user_id) {
    return NextResponse.json({ error: 'Solo los Miembros Oficiales con Roblox validado pueden confirmar su identidad.' }, { status: 403 });
  }

  const { error: detailsError } = await supabaseAdmin
    .from('profiles')
    .update({
      tiktok_user: tiktokUser,
      declared_minecraft_username: minecraftUsername || null,
    })
    .eq('id', user.id);

  if (detailsError) {
    console.error('[Identity confirmation details]:', detailsError.message);
    return NextResponse.json({ error: 'No se pudieron guardar tus cuentas.' }, { status: 500 });
  }

  const isOwnerRobloxAccount = profile.is_admin && profile.roblox_user?.toLowerCase() === 'milumonrt';
  if (!isOwnerRobloxAccount) {
    try {
      await tagRobloxUser(Number(profile.roblox_user_id), 'add', `🐣 ${displayName} 🐣`);
    } catch (error) {
      console.error('[Identity confirmation Roblox]:', error);
      return NextResponse.json({
        error: friendlyRobloxError(error),
        identityConfirmed: false,
        detailsSaved: true,
      }, { status: 502 });
    }
  }

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      roblox_display_name: `🐣 ${displayName} 🐣`,
      identity_confirmed_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('roblox_user, roblox_display_name, roblox_avatar_url, tiktok_user, declared_minecraft_username, identity_confirmed_at')
    .single();

  if (updateError) {
    console.error('[Identity confirmation profile]:', updateError.message);
    return NextResponse.json({ error: 'Roblox fue actualizado, pero no se pudo guardar la confirmación local.' }, { status: 500 });
  }

  return NextResponse.json({ identityConfirmed: true, profile: updatedProfile });
}
