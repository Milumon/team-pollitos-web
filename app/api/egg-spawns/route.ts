import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type EggSpawnPayload = {
  egg_name: string;
  rarity?: string;
  zone?: string;
  server_info?: string;
  image_url?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

function hasAccess(request: NextRequest): boolean {
  const sharedSecret = process.env.ROBLOX_ALEXA_SHARED_SECRET || process.env.MINECRAFT_BRIDGE_TOKEN;
  const receivedSecret = request.headers.get('x-shared-secret') || request.headers.get('x-minecraft-bridge-token');
  if (sharedSecret && receivedSecret && receivedSecret === sharedSecret) {
    return true;
  }
  const auth = request.headers.get('authorization');
  if (auth && sharedSecret && auth === `Bearer ${sharedSecret}`) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '10', 10), 1), 50);

  const { data, error } = await supabaseAdmin
    .from('egg_spawns')
    .select('id, egg_name, rarity, zone, server_info, image_url, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Egg Spawns GET]:', error.message);
    return NextResponse.json({ error: 'No se pudieron consultar los spawns.' }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: EggSpawnPayload;
  try {
    body = await request.json() as EggSpawnPayload;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.egg_name) {
    return NextResponse.json({ error: 'El campo egg_name es obligatorio' }, { status: 400 });
  }

    const insertPayload: Record<string, unknown> = {
      egg_name: body.egg_name.trim(),
      rarity: body.rarity?.trim() || 'secreto',
      zone: body.zone?.trim() || 'Desconocida',
      server_info: body.server_info || null,
      image_url: body.image_url || null,
      metadata: body.metadata || {},
    };

    if (body.created_at) {
      insertPayload.created_at = body.created_at;
    }

    const { data, error } = await supabaseAdmin
      .from('egg_spawns')
      .insert(insertPayload)
      .select()
      .single();

  if (error) {
    console.error('[Egg Spawns POST]:', error.message);
    return NextResponse.json({ error: 'Error al registrar el spawn en Supabase' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    spawn: data,
  });
}
