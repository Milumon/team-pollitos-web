import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMinecraftDiscordNotification } from '@/lib/discordMinecraft';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const token = authHeader.substring('Bearer '.length);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      robloxUsername,
      tiktokUsername,
      memberType = 'pollito_invitado',
      isReturning,
      banReason,
      returnReason,
      testimonial,
      forceClaim,
      claimReason,
    } = body;

    // Validate required fields
    if (!robloxUsername || !tiktokUsername) {
      return NextResponse.json(
        { error: 'El nombre de usuario de Roblox y TikTok son obligatorios.' },
        { status: 400 }
      );
    }

    if (isReturning && (!banReason || !returnReason)) {
      return NextResponse.json(
        { error: 'Para postulaciones de re-ingreso, los motivos de baneo y retorno son obligatorios.' },
        { status: 400 }
      );
    }

    // Normalize usernames
    const normalizedRoblox = String(robloxUsername).trim();
    let normalizedTiktok = String(tiktokUsername).trim();
    if (normalizedTiktok.startsWith('@')) {
      normalizedTiktok = normalizedTiktok.substring(1);
    }
    normalizedTiktok = normalizedTiktok.toLowerCase();

    // Verify Roblox User exists
    let robloxUserId: number | null = null;
    let finalRobloxName = normalizedRoblox;
    let avatarUrl: string | null = null;
    try {
      const robloxCheckRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ usernames: [normalizedRoblox] }),
      });
      if (robloxCheckRes.ok) {
        const robloxCheckData = (await robloxCheckRes.json()) as { data?: Array<{ id: number; name: string }> };
        const robloxUserRecord = robloxCheckData.data?.[0];
        if (robloxUserRecord && Number.isFinite(robloxUserRecord.id)) {
          robloxUserId = robloxUserRecord.id;
          finalRobloxName = robloxUserRecord.name;
          
          // Get avatar
          const avatarRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar?userIds=${robloxUserId}&size=420x420&format=Png&isCircular=false`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
          );
          if (avatarRes.ok) {
            const avatarData = await avatarRes.json();
            const item = avatarData?.data?.[0];
            if (item?.state === 'Completed') {
              avatarUrl = item.imageUrl || null;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error al verificar usuario de Roblox:', err);
    }

    if (!robloxUserId) {
      return NextResponse.json(
        { error: 'El usuario de Roblox ingresado no existe en Roblox. Por favor, verifica el nombre.' },
        { status: 404 }
      );
    }

    // Verificar si el robloxUserId ya está vinculado a OTRO usuario
    const { data: duplicateProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('roblox_user_id', robloxUserId)
      .not('id', 'eq', user.id)
      .maybeSingle();

    let isClaim = false;
    if (duplicateProfile) {
      if (!forceClaim) {
        const { data: { user: conflictedUser } } = await supabaseAdmin.auth.admin.getUserById(duplicateProfile.id);
        const emailText = conflictedUser?.email ? conflictedUser.email : 'otro usuario';
        
        const maskEmail = (email: string) => {
          const [localPart, domain] = email.split('@');
          if (localPart.length <= 3) return `${localPart[0]}***@${domain}`;
          return `${localPart.substring(0, 2)}***${localPart.substring(localPart.length - 1)}@${domain}`;
        };
        const masked = maskEmail(emailText);

        return NextResponse.json(
          { 
            error: `Esta cuenta de Roblox ya está vinculada al correo ${masked}.`,
            isDuplicate: true,
            conflictedEmail: masked
          },
          { status: 400 }
        );
      }
      isClaim = true;
    }

    const assignedRank = memberType === 'pollito_oficial' ? 'pollito_oficial' : 'pollito_invitado';
    const linkStatus = memberType === 'pollito_invitado' ? 'approved' : 'pending';

    // Upsert interview_history
    const { data: historyData, error: historyError } = await supabaseAdmin
      .from('interview_history')
      .upsert(
        {
          roblox_user: finalRobloxName,
          tiktok_user: normalizedTiktok,
          status: linkStatus,
          user_id: user.id,
          ban_reason: isReturning ? banReason.trim() : null,
          return_reason: isReturning ? returnReason.trim() : null,
          already_interviewed: memberType === 'pollito_oficial',
        },
        { onConflict: 'roblox_user,tiktok_user' }
      )
      .select()
      .single();

    if (historyError) {
      console.error('[Interview history error]:', historyError.message);
    }

    // Upsert profile
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        roblox_user_id: isClaim ? null : robloxUserId,
        roblox_user: finalRobloxName,
        roblox_display_name: finalRobloxName,
        roblox_avatar_url: avatarUrl,
        tiktok_user: normalizedTiktok,
        link_status: linkStatus,
        minecraft_rank: assignedRank,
        testimonial: testimonial ? String(testimonial).trim() : null,
        testimonial_approved: false,
        rejection_reason: isClaim ? (claimReason ? `RECLAMO: ${claimReason.trim()}` : 'RECLAMO: Sin motivo') : null,
      }, { onConflict: 'id' });

    if (profileUpsertError) {
      return NextResponse.json({ error: profileUpsertError.message }, { status: 500 });
    }

    if (linkStatus === 'approved') {
      void sendMinecraftDiscordNotification({
        type: 'whitelist',
        player: finalRobloxName,
        rank: assignedRank === 'pollito_oficial' ? '👑 Pollito Oficial' : '🐣 Pollito Invitado',
      });
    }

    return NextResponse.json({ success: true, interview: historyData, memberType: assignedRank, linkStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
