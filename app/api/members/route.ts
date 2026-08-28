import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/members - Obtener lista de miembros (oficiales, invitados y admins)
export async function GET() {
  try {
    const { data: members, error } = await supabaseAdmin
      .from('profiles')
      .select('roblox_user, roblox_display_name, roblox_avatar_url, minecraft_rank, role, is_admin')
      .eq('link_status', 'approved')
      .order('roblox_display_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(members || []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
