import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('minecraft_locations')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      // Fallback defaults if table is empty or migrating
      return NextResponse.json({
        locations: [
          { id: '1', name: 'Spawn Principal', emoji: '🏛️', x: 0, y: 64, z: 0, dimension: 'overworld', description: 'Punto de aparición oficial' },
          { id: '2', name: 'Pueblo Pollito', emoji: '🏘️', x: 150, y: 70, z: -200, dimension: 'overworld', description: 'Zona comunitaria del Team Pollito' },
          { id: '3', name: 'Arena de Eventos', emoji: '🎪', x: -300, y: 65, z: 100, dimension: 'overworld', description: 'Minijuegos y eventos especiales' },
        ],
      });
    }

    return NextResponse.json({ locations: data || [] });
  } catch (err) {
    return NextResponse.json({
      locations: [
        { id: '1', name: 'Spawn Principal', emoji: '🏛️', x: 0, y: 64, z: 0, dimension: 'overworld', description: 'Punto de aparición oficial' },
        { id: '2', name: 'Pueblo Pollito', emoji: '🏘️', x: 150, y: 70, z: -200, dimension: 'overworld', description: 'Zona comunitaria del Team Pollito' },
        { id: '3', name: 'Arena de Eventos', emoji: '🎪', x: -300, y: 65, z: 100, dimension: 'overworld', description: 'Minijuegos y eventos especiales' },
      ],
    });
  }
}