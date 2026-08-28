import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/members - Obtener lista de miembros aprobados (oficiales, moderadores, invitados y admins)
export async function GET() {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (error) {
      console.error('[GET /api/members error]:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = (profiles ?? [])
      .filter((p) => Boolean(p.roblox_user && String(p.roblox_user).trim().length > 0 && p.link_status === 'approved'))
      .map((p) => {
        const robloxUser = String(p.roblox_user || '');
        const robloxDisplayName = String(p.roblox_display_name || robloxUser || 'Pollito');
        const robloxAvatarUrl = typeof p.roblox_avatar_url === 'string' ? p.roblox_avatar_url : null;
        const isAdmin = Boolean(p.is_admin || robloxUser.toLowerCase().includes('milumon') || p.minecraft_rank === 'pollito_admin');
        const minecraftRank = isAdmin ? 'pollito_admin' : (typeof p.minecraft_rank === 'string' ? p.minecraft_rank : 'pollito_oficial');

        return {
          id: String(p.id || robloxUser),
          roblox_user: robloxUser,
          roblox_display_name: robloxDisplayName,
          roblox_avatar_url: robloxAvatarUrl,
          minecraft_rank: minecraftRank,
          is_admin: isAdmin,
        };
      });

    filtered.sort((a, b) => a.roblox_display_name.localeCompare(b.roblox_display_name));

    return NextResponse.json(filtered, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}