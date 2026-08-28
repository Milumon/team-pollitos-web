import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorized } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/auditLogger';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS = [
  'approve',
  'reject',
  'set_rank',
  'soundboard_enable',
  'soundboard_disable',
  'toggle_admin'
] as const;

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const authHeader = request.headers.get('Authorization');
  let adminEmail = 'admin-token@system';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring('Bearer '.length);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user?.email) adminEmail = user.email;
  }

  try {
    const body = await request.json();
    const { userIds, action, rank, reason, isAdmin } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Debes seleccionar al menos un usuario.' }, { status: 400 });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'approve') {
      updates.link_status = 'approved';
      updates.rejection_reason = null;
      updates.roblox_verified_at = new Date().toISOString();
    } else if (action === 'reject') {
      updates.link_status = 'rejected';
      updates.rejection_reason = reason || 'Solicitud rechazada por administración.';
    } else if (action === 'set_rank') {
      if (!['pollito_invitado', 'pollito_oficial', 'pollito_moderador', 'pollito_admin'].includes(rank)) {
        return NextResponse.json({ error: 'Rango no válido.' }, { status: 400 });
      }
      updates.minecraft_rank = rank;
    } else if (action === 'soundboard_enable') {
      updates.soundboard_disabled = false;
      updates.perm_upload_images = true;
      updates.perm_upload_videos = true;
      updates.perm_upload_audio = true;
      updates.perm_tts_text = true;
      updates.perm_tts_record = true;
      updates.perm_trigger_sounds = true;
      updates.perm_trigger_media = true;
    } else if (action === 'soundboard_disable') {
      updates.soundboard_disabled = true;
      updates.perm_upload_images = false;
      updates.perm_upload_videos = false;
      updates.perm_upload_audio = false;
      updates.perm_tts_text = false;
      updates.perm_tts_record = false;
      updates.perm_trigger_sounds = false;
      updates.perm_trigger_media = false;
    } else if (action === 'toggle_admin') {
      updates.is_admin = Boolean(isAdmin);
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .in('id', userIds);

    if (error) {
      console.error('[POST /api/admin/users/bulk error]:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAdminAction(adminEmail, `Acción masiva en usuarios: ${action}`, {
      target_user_count: userIds.length,
      target_user_ids: userIds,
      action,
      updates,
    });

    return NextResponse.json({
      success: true,
      affected: userIds.length,
      message: `Acción "${action}" aplicada a ${userIds.length} usuarios exitosamente.`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
