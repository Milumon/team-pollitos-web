import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type LeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  count: number;
};

type AggregateEntry = LeaderboardEntry & { fallbackAvatarUrl: string | null };

type LeaderboardMaps = {
  usage: Map<string, AggregateEntry>;
  sounds: Map<string, AggregateEntry>;
  images: Map<string, AggregateEntry>;
};

const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  now.setDate(now.getDate() - daysSinceMonday);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
};

const sortTopThree = (entries: AggregateEntry[]) => entries
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  .slice(0, 3)
  .map((entry) => {
    const { fallbackAvatarUrl, ...result } = entry;
    void fallbackAvatarUrl;
    return result;
  });

const buildLeaderboardMaps = (
  events: Array<{ user_id: string; sender_roblox_user: string | null; sender_avatar_url: string | null }>,
  uploads: Array<{ owner_user_id: string; media_type: string | null }>,
): LeaderboardMaps => {
  const maps: LeaderboardMaps = {
    usage: new Map(),
    sounds: new Map(),
    images: new Map(),
  };

  for (const event of events) {
    const current = maps.usage.get(event.user_id) ?? {
      userId: event.user_id,
      name: event.sender_roblox_user || 'Pollito',
      avatarUrl: null,
      fallbackAvatarUrl: event.sender_avatar_url,
      count: 0,
    };
    current.count += 1;
    if (event.sender_roblox_user) current.name = event.sender_roblox_user;
    if (event.sender_avatar_url) current.fallbackAvatarUrl = event.sender_avatar_url;
    maps.usage.set(event.user_id, current);
  }

  for (const upload of uploads) {
    const target = upload.media_type === 'image' || upload.media_type === 'image_audio'
      ? maps.images
      : upload.media_type === 'video'
        ? null
        : maps.sounds;
    if (!target) continue;

    const current = target.get(upload.owner_user_id) ?? {
      userId: upload.owner_user_id,
      name: 'Pollito',
      avatarUrl: null,
      fallbackAvatarUrl: null,
      count: 0,
    };
    current.count += 1;
    target.set(upload.owner_user_id, current);
  }

  return maps;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const token = authHeader.substring('Bearer '.length);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const weekStart = getWeekStart();
    const [{ data: events, error: eventsError }, { data: uploads, error: uploadsError }] = await Promise.all([
      supabaseAdmin
        .from('stream_events')
        .select('user_id, sender_roblox_user, sender_avatar_url, created_at')
        .not('user_id', 'is', null),
      supabaseAdmin
        .from('soundboard_sounds')
        .select('owner_user_id, media_type, created_at')
        .not('owner_user_id', 'is', null),
    ]);

    if (eventsError) throw eventsError;
    if (uploadsError) throw uploadsError;

    const allEvents = events ?? [];
    const allUploads = uploads ?? [];
    const weeklyMaps = buildLeaderboardMaps(
      allEvents.filter((event) => event.created_at >= weekStart),
      allUploads.filter((upload) => upload.created_at >= weekStart),
    );
    const allTimeMaps = buildLeaderboardMaps(allEvents, allUploads);

    const userIds = [...new Set([
      ...weeklyMaps.usage.keys(),
      ...weeklyMaps.sounds.keys(),
      ...weeklyMaps.images.keys(),
      ...allTimeMaps.usage.keys(),
      ...allTimeMaps.sounds.keys(),
      ...allTimeMaps.images.keys(),
    ])];
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, roblox_user, roblox_display_name, roblox_avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      for (const maps of [weeklyMaps, allTimeMaps]) {
        for (const map of [maps.usage, maps.sounds, maps.images]) {
          for (const entry of map.values()) {
            const profile = profileMap.get(entry.userId);
            if (!profile) continue;
            entry.name = profile.roblox_display_name || profile.roblox_user || entry.name;
            entry.avatarUrl = profile.roblox_avatar_url || entry.fallbackAvatarUrl;
          }
        }
      }
    }

    return NextResponse.json({
      weekStart,
      weekly: {
        usage: sortTopThree([...weeklyMaps.usage.values()]),
        sounds: sortTopThree([...weeklyMaps.sounds.values()]),
        images: sortTopThree([...weeklyMaps.images.values()]),
      },
      allTime: {
        usage: sortTopThree([...allTimeMaps.usage.values()]),
        sounds: sortTopThree([...allTimeMaps.sounds.values()]),
        images: sortTopThree([...allTimeMaps.images.values()]),
      },
    });
  } catch (error) {
    console.error('[Leaderboard GET Error]:', error);
    const message = error instanceof Error ? error.message : 'Error al obtener el ranking semanal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
