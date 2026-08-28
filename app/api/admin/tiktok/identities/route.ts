import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSupabaseAdminUser } from '@/lib/supabaseAdminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIKTOK_ID = /^\d+$/;

export async function GET(request: NextRequest) {
  if (!await getSupabaseAdminUser(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 300);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return NextResponse.json({ error: 'limit must be an integer between 1 and 500' }, { status: 400 });
  }

  try {
    // 1. Fetch unlinked / review identities via RPC
    const { data: reviewData, error: reviewError } = await supabaseAdmin.rpc('list_tiktok_identity_review', { p_limit: limit });
    if (reviewError) {
      console.error('[TikTok identity review GET error]:', reviewError.message);
    }
    const unlinkedIdentities = (reviewData ?? []).filter((i: { status: string; linked_profile_id: string | null }) => i.status !== 'linked' && !i.linked_profile_id);

    // 2. Fetch all linked records from tiktok_identity_links
    const { data: linkedLinks, error: linksError } = await supabaseAdmin
      .from('tiktok_identity_links')
      .select('tiktok_id, profile_id, link_status, updated_at')
      .eq('link_status', 'linked');

    const linkedTiktokIds = (linkedLinks ?? []).map((l) => l.tiktok_id);

    // 3. For linked tiktok_ids, get metadata from tiktok_ranking_entries
    let linkedIdentities: Array<{
      tiktok_id: string;
      display_id: string;
      nickname: string;
      ranking_entry_count: number;
      status: 'linked';
      linked_profile_id: string;
      candidate_count: number;
      candidates: Array<{ id: string; name: string; roblox_user: string | null }>;
    }> = [];

    if (linkedTiktokIds.length > 0) {
      const { data: entries } = await supabaseAdmin
        .from('tiktok_ranking_entries')
        .select('tiktok_id, display_id, nickname')
        .in('tiktok_id', linkedTiktokIds)
        .order('id', { ascending: false });

      const entryMetaMap = new Map<string, { display_id: string; nickname: string; count: number }>();
      (entries ?? []).forEach((e) => {
        const existing = entryMetaMap.get(e.tiktok_id);
        if (existing) {
          existing.count += 1;
        } else {
          entryMetaMap.set(e.tiktok_id, {
            display_id: e.display_id,
            nickname: e.nickname,
            count: 1,
          });
        }
      });

      linkedIdentities = (linkedLinks ?? []).map((link) => {
        const meta = entryMetaMap.get(link.tiktok_id);
        return {
          tiktok_id: link.tiktok_id,
          display_id: meta?.display_id || link.tiktok_id,
          nickname: meta?.nickname || '',
          ranking_entry_count: meta?.count || 1,
          status: 'linked' as const,
          linked_profile_id: link.profile_id,
          candidate_count: 0,
          candidates: [],
        };
      });
    }

    // 4. Combine linked (first) and unlinked identities
    const allIdentities = [...linkedIdentities, ...unlinkedIdentities];

    return NextResponse.json({ identities: allIdentities }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar identidades';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await getSupabaseAdminUser(request);
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { tiktok_id?: unknown; profile_id?: unknown; reason?: unknown };
  try {
    body = await request.json() as { tiktok_id?: unknown; profile_id?: unknown; reason?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.tiktok_id !== 'string' || !TIKTOK_ID.test(body.tiktok_id)) {
    return NextResponse.json({ error: 'tiktok_id must be a decimal string' }, { status: 400 });
  }
  if (body.profile_id !== null && (typeof body.profile_id !== 'string' || !UUID.test(body.profile_id))) {
    return NextResponse.json({ error: 'profile_id must be an approved profile UUID or null' }, { status: 400 });
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.length > 1000) {
    return NextResponse.json({ error: 'reason must contain between 3 and 1000 characters' }, { status: 400 });
  }

  const profileId = body.profile_id as string | null;
  const tiktokId = body.tiktok_id as string;

  try {
    // 1. If linking, upsert into tiktok_identity_links
    if (profileId) {
      await supabaseAdmin.from('tiktok_identity_links').upsert({
        tiktok_id: tiktokId,
        profile_id: profileId,
        link_status: 'linked',
        updated_by: actor.email ?? actor.id,
        updated_at: new Date().toISOString(),
      });

      // Update ranking entries
      await supabaseAdmin
        .from('tiktok_ranking_entries')
        .update({ linked_profile_id: profileId })
        .eq('tiktok_id', tiktokId);
    } else {
      // If unlinking, delete from tiktok_identity_links
      await supabaseAdmin
        .from('tiktok_identity_links')
        .delete()
        .eq('tiktok_id', tiktokId);

      // Nullify in ranking entries
      await supabaseAdmin
        .from('tiktok_ranking_entries')
        .update({ linked_profile_id: null })
        .eq('tiktok_id', tiktokId);
    }

    return NextResponse.json({ success: true, tiktok_id: tiktokId, profile_id: profileId }, { status: 200 });
  } catch (err) {
    console.error('[TikTok identity link PATCH error]:', err);
    return NextResponse.json({ error: 'Unable to update TikTok identity link' }, { status: 500 });
  }
}
