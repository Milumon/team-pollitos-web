import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message || message.length > 256) {
      return NextResponse.json({ error: 'El mensaje debe tener entre 1 y 256 caracteres' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    let sender = 'admin';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user?.email) sender = user.email;
    }

    const { data, error } = await supabaseAdmin
      .from('minecraft_broadcasts')
      .insert({
        message,
        sent_by: sender,
        delivered: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, broadcast: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al enviar broadcast';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('minecraft_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return NextResponse.json({ broadcasts: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al listar broadcasts';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}