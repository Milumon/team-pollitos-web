import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('stream_chat_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('[Chat Settings GET]:', error.message);
      return NextResponse.json({ error: 'Error al obtener configuración de chat' }, { status: 500 });
    }

    if (!data) {
      const { data: seeded, error: seedError } = await supabaseAdmin
        .from('stream_chat_settings')
        .insert({ id: 1 })
        .select()
        .single();

      if (seedError) throw seedError;
      return NextResponse.json(seeded);
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.followers_only === 'boolean') updates.followers_only = body.followers_only;
    if (typeof body.subscribers_only === 'boolean') updates.subscribers_only = body.subscribers_only;
    if (typeof body.moderators_only === 'boolean') updates.moderators_only = body.moderators_only;
    if (typeof body.min_team_member_level === 'number') updates.min_team_member_level = Math.max(0, Math.min(50, body.min_team_member_level));
    if (typeof body.emoji_filter === 'string' || body.emoji_filter === null) updates.emoji_filter = body.emoji_filter;
    
    if (typeof body.chat_position_x === 'number') updates.chat_position_x = body.chat_position_x;
    if (typeof body.chat_position_y === 'number') updates.chat_position_y = body.chat_position_y;
    if (typeof body.chat_width === 'number') updates.chat_width = body.chat_width;
    if (typeof body.chat_max_messages === 'number') updates.chat_max_messages = Math.max(3, Math.min(50, body.chat_max_messages));
    if (typeof body.chat_font_size === 'number') updates.chat_font_size = Math.max(10, Math.min(32, body.chat_font_size));
    if (typeof body.chat_opacity === 'number') updates.chat_opacity = Math.max(0.1, Math.min(1.0, body.chat_opacity));
    if (typeof body.chat_direction === 'string' && ['bottom-up', 'top-down'].includes(body.chat_direction)) {
      updates.chat_direction = body.chat_direction;
    }
    if (typeof body.chat_theme === 'string' && ['glassmorphism', 'solid', 'minimal', 'neon'].includes(body.chat_theme)) {
      updates.chat_theme = body.chat_theme;
    }
    if (typeof body.show_badges === 'boolean') updates.show_badges = body.show_badges;
    if (typeof body.is_enabled === 'boolean') updates.is_enabled = body.is_enabled;

    const { data, error } = await supabaseAdmin
      .from('stream_chat_settings')
      .upsert({ id: 1, ...updates })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, settings: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al guardar configuración';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}