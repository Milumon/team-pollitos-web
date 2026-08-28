import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function hasBridgeAccess(request: NextRequest): boolean {
  const expected = process.env.MINECRAFT_BRIDGE_TOKEN || process.env.BRIDGE_API_KEY;
  const received = request.headers.get('x-minecraft-bridge-token') || request.headers.get('x-bridge-token');
  return Boolean(expected && received && received === expected);
}

export async function GET(request: NextRequest) {
  if (!hasBridgeAccess(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Fetch pending broadcasts
    const { data, error } = await supabaseAdmin
      .from('minecraft_broadcasts')
      .select('id, message, sent_by, created_at')
      .eq('delivered', false)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;

    const broadcasts = data || [];

    // Mark as delivered
    if (broadcasts.length > 0) {
      const ids = broadcasts.map(b => b.id);
      await supabaseAdmin
        .from('minecraft_broadcasts')
        .update({ delivered: true })
        .in('id', ids);
    }

    return NextResponse.json({ broadcasts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al consultar broadcasts pendientes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}