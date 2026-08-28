import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { MAX_RANKING_ENTRIES_PER_SNAPSHOT } from '@/lib/tiktokRankingLimits';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  let profileId: string | null = null;

  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(match[1]);
    if (authError || !authData.user) return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    profileId = authData.user.id;
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam === null ? 100 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RANKING_ENTRIES_PER_SNAPSHOT) {
    return NextResponse.json(
      { error: `limit must be an integer between 1 and ${MAX_RANKING_ENTRIES_PER_SNAPSHOT}` },
      { status: 400 },
    );
  }

  const batchId = request.nextUrl.searchParams.get('batch_id');
  if (batchId) {
    if (!UUID_PATTERN.test(batchId)) {
      return NextResponse.json({ error: 'A valid authenticated session and batch_id are required' }, { status: 400 });
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('tiktok_ranking_batches')
      .select('id,captured_at')
      .eq('id', batchId)
      .maybeSingle();
    if (batchError) return NextResponse.json({ error: 'Unable to load ranking snapshot' }, { status: 500 });
    if (!batch) return NextResponse.json({ error: 'Ranking snapshot not found' }, { status: 404 });

    const { data: sets, error: setsError } = await supabaseAdmin
      .from('tiktok_ranking_sets')
      .select('id,metric,period,window_begin,window_end')
      .eq('batch_id', batchId)
      .order('metric')
      .order('period');
    if (setsError) return NextResponse.json({ error: 'Unable to load ranking snapshot' }, { status: 500 });

    const setIds = (sets ?? []).map((set) => set.id);
    const { data: entries, error: entriesError } = setIds.length
      ? await supabaseAdmin.from('tiktok_ranking_entries')
        .select('set_id,position,tiktok_id,display_id,nickname,avatar_uri,value,linked_profile_id')
        .in('set_id', setIds)
        .lte('position', limit)
        .order('position')
      : { data: [], error: null };
    if (entriesError) return NextResponse.json({ error: 'Unable to load ranking snapshot' }, { status: 500 });

    const linkedIds = [...new Set((entries ?? []).map((entry) => entry.linked_profile_id).filter((id): id is string => Boolean(id)))];
    const { data: profiles, error: profilesError } = linkedIds.length
      ? await supabaseAdmin.from('profiles')
        .select('id,link_status,roblox_user,roblox_display_name,roblox_avatar_url')
        .in('id', linkedIds)
      : { data: [], error: null };
    if (profilesError) return NextResponse.json({ error: 'Unable to load ranking snapshot' }, { status: 500 });
    const profileMap = new Map((profiles ?? []).filter((profile) => profile.link_status === 'approved').map((profile) => [profile.id, profile]));

    return NextResponse.json({
      batch_id: batch.id,
      captured_at: batch.captured_at,
      sets: (sets ?? []).map((set) => ({
        metric: set.metric,
        period: set.period,
        window: { begin: set.window_begin, end: set.window_end },
        entries: (entries ?? []).filter((entry) => entry.set_id === set.id).map((entry) => {
          const profile = entry.linked_profile_id ? profileMap.get(entry.linked_profile_id) : null;
          return {
            position: entry.position,
            display_id: entry.display_id,
            nickname: entry.nickname,
            value: entry.value,
            tiktok_avatar_uri: entry.avatar_uri,
            profile: profile ? {
              roblox_user: profile.roblox_user ?? '',
              roblox_display_name: profile.roblox_display_name ?? profile.roblox_user ?? entry.display_id,
              roblox_avatar_url: profile.roblox_avatar_url,
            } : null,
          };
        }),
        me: null,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const { data, error } = await supabaseAdmin.rpc('get_current_tiktok_rankings', {
    p_profile_id: profileId,
    p_limit: limit,
  });
  if (error) {
    console.error('[TikTok rankings GET Error]:', error);
    return NextResponse.json({ error: 'Unable to load current rankings' }, { status: 500 });
  }
  return NextResponse.json(
    data ?? {
      batch_id: null,
      captured_at: null,
      sets: [],
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
