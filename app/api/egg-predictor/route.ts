import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type EggInfo = {
  name: string;
  rarity: 'secret' | 'eternal' | 'divine' | string;
  zone: string;
  target_timestamp: number;
  probability: string;
};

type PredictionPayload = {
  next_egg: EggInfo | null;
  upcoming_eggs: EggInfo[];
  raw_text?: string;
};

function hasAccess(request: NextRequest): boolean {
  const sharedSecret = process.env.ROBLOX_ALEXA_SHARED_SECRET || process.env.MINECRAFT_BRIDGE_TOKEN;
  const receivedSecret = request.headers.get('x-shared-secret') || request.headers.get('x-minecraft-bridge-token');
  if (sharedSecret && receivedSecret && receivedSecret === sharedSecret) {
    return true;
  }
  // También permitir si se envía Authorization Bearer con token
  const auth = request.headers.get('authorization');
  if (auth && sharedSecret && auth === `Bearer ${sharedSecret}`) {
    return true;
  }
  return false;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('egg_predictions')
    .select('id, next_egg, upcoming_eggs, raw_text, updated_at')
    .eq('id', 'current')
    .maybeSingle();

  if (error) {
    console.error('[Egg Predictor GET]:', error.message);
    return NextResponse.json({ error: 'No se pudo consultar el estado de predicción.' }, { status: 500 });
  }

  return NextResponse.json(data ?? {
    id: 'current',
    next_egg: null,
    upcoming_eggs: [],
    updated_at: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: PredictionPayload;
  try {
    body = await request.json() as PredictionPayload;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('egg_predictions')
    .upsert({
      id: 'current',
      next_egg: body.next_egg ?? {},
      upcoming_eggs: Array.isArray(body.upcoming_eggs) ? body.upcoming_eggs : [],
      raw_text: typeof body.raw_text === 'string' ? body.raw_text : null,
      updated_at: now,
    }, { onConflict: 'id' });

  if (error) {
    console.error('[Egg Predictor POST]:', error.message);
    return NextResponse.json({ error: 'No se pudo guardar la predicción.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated_at: now });
}
