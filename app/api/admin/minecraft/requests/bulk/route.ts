import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSupabaseAdminUser } from '@/lib/supabaseAdminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { accountIds?: unknown; action?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const accountIds = Array.isArray(body.accountIds) ? body.accountIds.filter((id): id is string => typeof id === 'string') : [];
  const action = body.action;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

  if (accountIds.length === 0 || !['approve', 'reject', 'revoke', 'delete'].includes(String(action))) {
    return NextResponse.json({ error: 'Acción o cuentas inválidas.' }, { status: 400 });
  }

  const adminUser = await getSupabaseAdminUser(request);
  const now = new Date().toISOString();

  if (action === 'delete') {
    const { error } = await supabaseAdmin
      .from('minecraft_accounts')
      .delete()
      .in('id', accountIds);

    if (error) {
      console.error('[Admin Minecraft bulk delete]:', error.message);
      return NextResponse.json({ error: 'Error al eliminar las vinculaciones.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, count: accountIds.length, action: 'delete' });
  }

  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revoked';
  const updateData: Record<string, unknown> = {
    status,
    updated_at: now,
    approved_by: action === 'approve' ? adminUser?.id ?? null : null,
    approved_at: action === 'approve' ? now : null,
    revoked_at: action === 'revoke' ? now : null,
    rejection_reason: action === 'reject' ? reason : null,
  };

  const { error } = await supabaseAdmin
    .from('minecraft_accounts')
    .update(updateData)
    .in('id', accountIds);

  if (error) {
    console.error('[Admin Minecraft bulk update]:', error.message);
    return NextResponse.json({ error: 'Error al actualizar las vinculaciones en lote.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: accountIds.length, action });
}
