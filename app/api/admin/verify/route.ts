import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tagRobloxUser } from '@/lib/robloxAdmin';
import { isAuthorized } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/auditLogger';

async function fetchRobloxUserIdFromUsername(username: string): Promise<number | null> {
  try {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ usernames: [username.trim()] }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: { id?: number }[] };
    const userRecord = data.data?.[0];
    return Number.isFinite(userRecord?.id) ? (userRecord?.id as number) : null;
  } catch (error) {
    console.error('Error fetching Roblox User ID from username:', error);
    return null;
  }
}

async function fetchRobloxAvatar(userId: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const item = data?.data?.[0];
    return item?.state === 'Completed' ? item.imageUrl || null : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authHeader = request.headers.get('Authorization');
    let adminEmail = 'admin-token@system';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user?.email) adminEmail = user.email;
    }

    const body = await request.json();
    const { userId, action, rejectionReason } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId y action son requeridos.' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject' && action !== 'revoke') {
      return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 });
    }

    // 1. Fetch user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
    }

    if (action === 'approve') {
      let robloxUserId = profile.roblox_user_id ? Number(profile.roblox_user_id) : null;
      let robloxAvatarUrl = profile.roblox_avatar_url || null;

      if (!robloxUserId && profile.roblox_user) {
        // Resolver robloxUserId si estaba en null por reclamo
        robloxUserId = await fetchRobloxUserIdFromUsername(profile.roblox_user);
      }

      if (robloxUserId) {
        if (!robloxAvatarUrl) {
          robloxAvatarUrl = await fetchRobloxAvatar(robloxUserId);
        }

        // 1. Buscar si hay otro usuario que tenga este roblox_user_id vinculado
        const { data: conflictedProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, roblox_user_id')
          .eq('roblox_user_id', robloxUserId)
          .not('id', 'eq', userId)
          .maybeSingle();

        if (conflictedProfile) {
          // Desvincular al usuario anterior
          await supabaseAdmin
            .from('profiles')
            .update({
              roblox_user_id: null,
              roblox_user: null,
              roblox_display_name: null,
              roblox_avatar_url: null,
              roblox_verified_at: null,
              link_status: 'none',
              rejection_reason: 'Tu cuenta de Roblox fue reasignada a otro usuario por el administrador.',
            })
            .eq('id', conflictedProfile.id);

          try {
            await tagRobloxUser(Number(conflictedProfile.roblox_user_id), 'remove');
          } catch (tagErr) {
            console.error('Error al remover prefijo del usuario desvinculado:', tagErr);
          }
        }
      }

      // 2. Aprobar la postulación del nuevo usuario
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({
          link_status: 'approved',
          roblox_verified_at: new Date().toISOString(),
          roblox_user_id: robloxUserId, // Guardar el ID definitivo
          roblox_avatar_url: robloxAvatarUrl,
          rejection_reason: null, // Limpiar justificación de reclamo
        })
        .eq('id', userId);

      if (updateProfileError) {
        return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
      }

      // Upsert interview history to official
      const { error: historyError } = await supabaseAdmin
        .from('interview_history')
        .upsert(
          {
            roblox_user: profile.roblox_user,
            tiktok_user: profile.tiktok_user,
            status: 'official',
            user_id: userId,
          },
          { onConflict: 'roblox_user,tiktok_user' }
        );

      if (historyError) {
        console.warn('Fallo al actualizar interview_history a official:', historyError.message);
      }

      // Trigger Roblox tag addition
      if (robloxUserId) {
        try {
          await tagRobloxUser(robloxUserId, 'add');
        } catch (tagErr) {
          console.error('Error al poner prefijo en Roblox:', tagErr);
        }
      }

    } else if (action === 'reject') {
      // Reject profile link
      const reason = rejectionReason || 'Los datos brindados no coinciden o no son correctos.';
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({
          link_status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', userId);

      if (updateProfileError) {
        return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
      }

      // Mark pending interview_history as rejected
      const { error: historyError } = await supabaseAdmin
        .from('interview_history')
        .update({ status: 'rejected' })
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (historyError) {
        console.warn('Fallo al actualizar interview_history a rejected:', historyError.message);
      }

    } else if (action === 'revoke') {
      // Revoke profile link
      const reason = rejectionReason || 'Membresía revocada por el administrador.';
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({
          link_status: 'rejected',
          rejection_reason: reason,
          roblox_verified_at: null,
        })
        .eq('id', userId);

      if (updateProfileError) {
        return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
      }

      // Mark all interview_history records for this user as rejected
      const { error: historyError } = await supabaseAdmin
        .from('interview_history')
        .update({ status: 'rejected' })
        .eq('user_id', userId);

      if (historyError) {
        console.warn('Fallo al revocar interview_history:', historyError.message);
      }

      // Trigger Roblox tag removal
      if (profile.roblox_user_id) {
        try {
          await tagRobloxUser(Number(profile.roblox_user_id), 'remove');
        } catch (tagErr) {
          console.error('Error al remover prefijo en Roblox:', tagErr);
        }
      }
    }

    // Registrar log de auditoría
    let auditAction = 'Postulación procesada';
    if (action === 'approve') auditAction = 'Aprobó postulación VIP';
    else if (action === 'reject') auditAction = 'Rechazó postulación VIP';
    else if (action === 'revoke') auditAction = 'Revocó membresía VIP';

    await logAdminAction(adminEmail, auditAction, {
      target_user_id: userId,
      roblox_user: profile.roblox_user,
      reason: rejectionReason || null
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown verification error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
