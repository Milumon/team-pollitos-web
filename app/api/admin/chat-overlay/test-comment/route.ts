import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorized } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const testNicknames = ['Pollito VIP 💎', 'GamerPro 🎮', 'MiluFan 🐣', 'Moderador 🛡️', 'Alexis 🐔'];
    const testMessages = [
      '¡Hola a todos en el directo! 🐣🔥',
      '¿Qué juego sigue hoy Milu?',
      '¡Dejen su like y compartan el directo! ⭐',
      '¡Que buena jugada en Minecraft! 👏',
      '¡Un saludo a todo el Team Pollito!',
    ];
    const randIdx = Math.floor(Math.random() * testMessages.length);

    const payload = {
      tiktok_user: body.tiktok_user || ('pollito_' + Math.floor(Math.random() * 900 + 100)),
      nickname: body.nickname || testNicknames[randIdx],
      message: body.message || testMessages[randIdx],
      team_member_level: body.team_member_level ?? Math.floor(Math.random() * 20 + 1),
      is_follower: body.is_follower ?? true,
      is_subscriber: body.is_subscriber ?? true,
      is_moderator: body.is_moderator ?? (randIdx === 3),
    };

    const { data, error } = await supabaseAdmin
      .from('stream_comments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error inserting test stream_comment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, comment: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
