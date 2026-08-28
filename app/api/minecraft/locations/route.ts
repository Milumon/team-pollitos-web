import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const DEFAULT_LOCATIONS = [
  {
    id: '1',
    name: 'Spawn Principal',
    emoji: '🏛️',
    x: 0,
    y: 64,
    z: 0,
    dimension: 'overworld',
    description: 'Punto de inicio oficial, zona segura protegida del servidor y comando /spawn',
  },
  {
    id: '2',
    name: 'Fortaleza del End (Stronghold)',
    emoji: '🐉',
    x: 1488,
    y: 38,
    z: -736,
    dimension: 'overworld',
    description: 'Fortaleza subterránea con el Portal al End oficial y salas de librerías',
  },
  {
    id: '3',
    name: 'Fortaleza del Nether',
    emoji: '🌋',
    x: -160,
    y: 72,
    z: 240,
    dimension: 'nether',
    description: 'Castillo del Nether con generadores de Blazes, esqueletos de Wither y verrugas',
  },
  {
    id: '4',
    name: 'Bastión del Nether (Bastion)',
    emoji: '🐗',
    x: 96,
    y: 60,
    z: -368,
    dimension: 'nether',
    description: 'Gran fortaleza de Piglins con cofres de botín y plantillas de herrería',
  },
];

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('minecraft_locations')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ locations: DEFAULT_LOCATIONS });
    }

    return NextResponse.json({ locations: data });
  } catch {
    return NextResponse.json({ locations: DEFAULT_LOCATIONS });
  }
}