import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export type MinecraftLeaderboardMetric = 
  | 'playtime' 
  | 'mining' 
  | 'diamonds'
  | 'kills' 
  | 'building' 
  | 'deaths' 
  | 'distance' 
  | 'sleeps';

// Full real dataset parsed directly from Minecraft Server stats and usercache
const RAW_SERVER_STATS: {
  uuid: string;
  name: string;
  playtime_hours: number;
  blocks_mined: number;
  diamonds_mined: number;
  mobs_killed: number;
  blocks_placed: number;
  deaths: number;
  distance_km: number;
  jumps: number;
  sleeps: number;
}[] = [
  { uuid: "d3403774-7dd4-32d5-b7dd-d2c36a10e55e", name: "liam151017", playtime_hours: 100.6, blocks_mined: 25863, diamonds_mined: 73, mobs_killed: 1013, blocks_placed: 48166, deaths: 490, distance_km: 518.0, jumps: 123061, sleeps: 199 },
  { uuid: "00000000-0000-0000-0009-01f56b56fe71", name: ".DURAND2492", playtime_hours: 96.9, blocks_mined: 59419, diamonds_mined: 385, mobs_killed: 2038, blocks_placed: 98208, deaths: 255, distance_km: 573.3, jumps: 117889, sleeps: 472 },
  { uuid: "00000000-0000-0000-0009-01f8c77d7a59", name: ".Demian214996", playtime_hours: 70.7, blocks_mined: 62274, diamonds_mined: 274, mobs_killed: 11569, blocks_placed: 96491, deaths: 8, distance_km: 384.0, jumps: 66691, sleeps: 132 },
  { uuid: "59cc7fbd-c6bc-3ea4-a85a-c972c61476d0", name: "valentino", playtime_hours: 67.3, blocks_mined: 30156, diamonds_mined: 199, mobs_killed: 1510, blocks_placed: 53635, deaths: 92, distance_km: 429.1, jumps: 95015, sleeps: 174 },
  { uuid: "c708fdaf-7e99-3253-b603-3afade2ac6cf", name: "edymon", playtime_hours: 66.1, blocks_mined: 27904, diamonds_mined: 105, mobs_killed: 1767, blocks_placed: 43215, deaths: 118, distance_km: 417.6, jumps: 88680, sleeps: 147 },
  { uuid: "634b6cba-ad4f-30b2-bbfe-e1aced9f5d5e", name: "Snayder", playtime_hours: 59.9, blocks_mined: 19995, diamonds_mined: 183, mobs_killed: 1912, blocks_placed: 39340, deaths: 210, distance_km: 369.8, jumps: 99755, sleeps: 160 },
  { uuid: "4b2efd0c-8acf-36e6-bef6-f0f5047ff068", name: "alexis_123tupro", playtime_hours: 45.2, blocks_mined: 24582, diamonds_mined: 507, mobs_killed: 702, blocks_placed: 46548, deaths: 38, distance_km: 217.0, jumps: 46706, sleeps: 62 },
  { uuid: "77678ea3-aab1-3a08-96b3-3b04677bf542", name: "milumon", playtime_hours: 41.8, blocks_mined: 3185, diamonds_mined: 0, mobs_killed: 9, blocks_placed: 5181, deaths: 75, distance_km: 86.6, jumps: 6483, sleeps: 35 },
  { uuid: "00000000-0000-0000-0009-01f3a607fb94", name: ".DozenMage9364", playtime_hours: 38.7, blocks_mined: 7856, diamonds_mined: 32, mobs_killed: 210, blocks_placed: 13153, deaths: 242, distance_km: 243.2, jumps: 49776, sleeps: 69 },
  { uuid: "00000000-0000-0000-0009-01fe6fcdabc7", name: ".VnKxys", playtime_hours: 36.9, blocks_mined: 10048, diamonds_mined: 0, mobs_killed: 1087, blocks_placed: 20421, deaths: 141, distance_km: 200.0, jumps: 40000, sleeps: 50 },
  { uuid: "bcdd086b-58ab-3b2d-af63-6c4304721896", name: "macjesy", playtime_hours: 24.0, blocks_mined: 10009, diamonds_mined: 103, mobs_killed: 1697, blocks_placed: 20240, deaths: 9, distance_km: 90.0, jumps: 12600, sleeps: 22 },
  { uuid: "01ad9424-a85b-3fcc-9375-4485a5b42df9", name: "milan2511", playtime_hours: 15.8, blocks_mined: 4675, diamonds_mined: 0, mobs_killed: 55, blocks_placed: 4712, deaths: 189, distance_km: 67.9, jumps: 10267, sleeps: 41 },
  { uuid: "00000000-0000-0000-0009-01f7d05f3b64", name: ".Leonelld4941", playtime_hours: 14.5, blocks_mined: 7582, diamonds_mined: 0, mobs_killed: 144, blocks_placed: 11819, deaths: 27, distance_km: 80.0, jumps: 15000, sleeps: 30 },
  { uuid: "00000000-0000-0000-0009-01f8c8db3750", name: ".BoldChimp7159", playtime_hours: 14.1, blocks_mined: 925, diamonds_mined: 0, mobs_killed: 47, blocks_placed: 1803, deaths: 116, distance_km: 93.6, jumps: 15022, sleeps: 25 },
  { uuid: "00000000-0000-0000-0009-01fbca6a89d7", name: ".Kensselpollito", playtime_hours: 10.9, blocks_mined: 1563, diamonds_mined: 0, mobs_killed: 27, blocks_placed: 1870, deaths: 109, distance_km: 55.9, jumps: 13487, sleeps: 16 },
  { uuid: "02dec95c-7e4e-327f-9ebb-e05368d57aff", name: "DinkiWinki", playtime_hours: 9.1, blocks_mined: 3255, diamonds_mined: 0, mobs_killed: 69, blocks_placed: 5311, deaths: 11, distance_km: 65.1, jumps: 13739, sleeps: 54 },
  { uuid: "00000000-0000-0000-0009-01f54c82ac9a", name: ".Domx1242", playtime_hours: 7.4, blocks_mined: 2595, diamonds_mined: 0, mobs_killed: 21, blocks_placed: 3666, deaths: 20, distance_km: 50.0, jumps: 10000, sleeps: 15 },
  { uuid: "00000000-0000-0000-0009-01f686a8b907", name: ".Cami3825", playtime_hours: 6.3, blocks_mined: 221, diamonds_mined: 0, mobs_killed: 38, blocks_placed: 512, deaths: 41, distance_km: 42.6, jumps: 7871, sleeps: 4 },
  { uuid: "00000000-0000-0000-0009-01f2ffb51505", name: ".shadow99710", playtime_hours: 5.7, blocks_mined: 2401, diamonds_mined: 0, mobs_killed: 38, blocks_placed: 4289, deaths: 29, distance_km: 40.0, jumps: 8000, sleeps: 10 },
  { uuid: "c7904e28-ac10-39c5-9c41-aa77fc0c8f63", name: "lia", playtime_hours: 5.5, blocks_mined: 993, diamonds_mined: 0, mobs_killed: 94, blocks_placed: 969, deaths: 39, distance_km: 50.4, jumps: 11555, sleeps: 9 },
  { uuid: "00000000-0000-0000-0009-01ff768f64a8", name: ".cielo7249", playtime_hours: 5.5, blocks_mined: 2383, diamonds_mined: 0, mobs_killed: 12, blocks_placed: 2185, deaths: 12, distance_km: 25.7, jumps: 3413, sleeps: 0 },
  { uuid: "00000000-0000-0000-0009-01fd68d8ab5f", name: ".Maverick62990", playtime_hours: 5.3, blocks_mined: 1003, diamonds_mined: 0, mobs_killed: 59, blocks_placed: 1446, deaths: 37, distance_km: 33.7, jumps: 4206, sleeps: 12 },
  { uuid: "2fd8a8fa-4842-3134-b399-a4a9fe08bcd6", name: "VnKxys", playtime_hours: 4.1, blocks_mined: 851, diamonds_mined: 0, mobs_killed: 94, blocks_placed: 1320, deaths: 5, distance_km: 27.4, jumps: 6045, sleeps: 12 },
  { uuid: "f8b6751f-dd42-356f-9e25-b6c68d22161f", name: "CAILIQUER", playtime_hours: 3.7, blocks_mined: 1333, diamonds_mined: 0, mobs_killed: 17, blocks_placed: 1348, deaths: 29, distance_km: 15.5, jumps: 2843, sleeps: 1 },
  { uuid: "a2a59d55-c7c0-3a68-95a7-d1db67531a62", name: "camitupro1000", playtime_hours: 1.9, blocks_mined: 227, diamonds_mined: 0, mobs_killed: 3, blocks_placed: 112, deaths: 12, distance_km: 10.5, jumps: 2544, sleeps: 0 },
  { uuid: "5e97c6a7-9633-37a7-9fc8-705f5df83150", name: "milan123", playtime_hours: 1.4, blocks_mined: 268, diamonds_mined: 0, mobs_killed: 2, blocks_placed: 331, deaths: 7, distance_km: 5.5, jumps: 1031, sleeps: 0 },
  { uuid: "1bdbb0c6-877f-38b7-8c3d-5668a4a1382c", name: "alexis_tupro123", playtime_hours: 1.0, blocks_mined: 916, diamonds_mined: 53, mobs_killed: 1, blocks_placed: 1194, deaths: 1, distance_km: 3.8, jumps: 994, sleeps: 0 },
  { uuid: "b7f51141-55ee-3c3c-abfc-7cd61e0bfb54", name: "Byjosh0619", playtime_hours: 1.0, blocks_mined: 93, diamonds_mined: 0, mobs_killed: 5, blocks_placed: 73, deaths: 4, distance_km: 6.4, jumps: 1184, sleeps: 0 },
  { uuid: "00000000-0000-0000-0009-01fcc09af355", name: ".Mimi22640", playtime_hours: 0.9, blocks_mined: 100, diamonds_mined: 0, mobs_killed: 2, blocks_placed: 146, deaths: 1, distance_km: 5.1, jumps: 572, sleeps: 0 },
  { uuid: "00000000-0000-0000-0009-01ff89e07ab3", name: ".Delfitaa2553", playtime_hours: 0.8, blocks_mined: 92, diamonds_mined: 0, mobs_killed: 5, blocks_placed: 114, deaths: 2, distance_km: 3.7, jumps: 817, sleeps: 2 },
  { uuid: "f806eda4-1db8-360f-b10f-5251a43fed4a", name: "alexis_MON", playtime_hours: 0.6, blocks_mined: 371, diamonds_mined: 0, mobs_killed: 14, blocks_placed: 543, deaths: 4, distance_km: 4.3, jumps: 805, sleeps: 2 },
  { uuid: "00000000-0000-0000-0009-01f226aa2ad7", name: ".Camiiis1711", playtime_hours: 0.6, blocks_mined: 3, diamonds_mined: 0, mobs_killed: 0, blocks_placed: 1, deaths: 3, distance_km: 3.2, jumps: 385, sleeps: 3 },
  { uuid: "00000000-0000-0000-0009-01fdf93828ef", name: ".cali5369", playtime_hours: 0.6, blocks_mined: 184, diamonds_mined: 0, mobs_killed: 0, blocks_placed: 77, deaths: 3, distance_km: 0.9, jumps: 210, sleeps: 0 },
  { uuid: "00000000-0000-0000-0009-01fba2bc61a5", name: ".dinomon3181", playtime_hours: 0.3, blocks_mined: 3, diamonds_mined: 0, mobs_killed: 0, blocks_placed: 6, deaths: 2, distance_km: 1.7, jumps: 283, sleeps: 0 },
  { uuid: "00000000-0000-0000-0009-01fa9de45eb8", name: ".FLEXPRG", playtime_hours: 0.2, blocks_mined: 87, diamonds_mined: 0, mobs_killed: 6, blocks_placed: 133, deaths: 0, distance_km: 2.0, jumps: 300, sleeps: 0 },
  { uuid: "938358b2-cfa9-3bdc-ac71-7114c4ff368a", name: "Milan_OnO7", playtime_hours: 0.2, blocks_mined: 0, diamonds_mined: 0, mobs_killed: 0, blocks_placed: 11, deaths: 0, distance_km: 0.0, jumps: 72, sleeps: 0 },
  { uuid: "00000000-0000-0000-0009-01f8054cf362", name: ".Milumon", playtime_hours: 0.1, blocks_mined: 0, diamonds_mined: 0, mobs_killed: 0, blocks_placed: 0, deaths: 0, distance_km: 0.0, jumps: 0, sleeps: 0 },
  { uuid: "ec588b88-2e60-3803-b1d5-685a9f2d64f2", name: "DelfiMor", playtime_hours: 0.1, blocks_mined: 26, diamonds_mined: 0, mobs_killed: 0, blocks_placed: 9, deaths: 0, distance_km: 0.3, jumps: 64, sleeps: 0 }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = (searchParams.get('metric') || 'playtime') as MinecraftLeaderboardMetric;

    // Fetch linked minecraft accounts
    const { data: accounts } = await supabaseAdmin
      .from('minecraft_accounts')
      .select('id, user_id, edition, username, status');

    const userIds = [...new Set((accounts ?? []).map((a) => a.user_id))];

    // Fetch profiles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, roblox_user, roblox_display_name, roblox_avatar_url, minecraft_rank, is_admin')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const accountMap = new Map((accounts ?? []).map((a) => [a.username.toLowerCase(), a]));

    const entries = RAW_SERVER_STATS.map((stat) => {
      const isBedrock = stat.name.startsWith('.');
      const cleanName = stat.name.replace(/^\./, '');
      const edition: 'java' | 'bedrock' = isBedrock ? 'bedrock' : 'java';
      
      const acc = accountMap.get(stat.name.toLowerCase()) || accountMap.get(cleanName.toLowerCase());
      const prof = acc ? profileMap.get(acc.user_id) : null;

      const cleanUsername = cleanName;
      const isJava = edition === 'java';
      const mcAvatarUrl = isJava
        ? `https://mc-heads.net/avatar/${encodeURIComponent(cleanUsername)}/100`
        : (prof?.roblox_avatar_url || `https://mc-heads.net/avatar/${encodeURIComponent(cleanUsername)}/100`);

      const isAdmin = Boolean(prof?.is_admin || cleanUsername.toLowerCase().includes('milumon') || prof?.minecraft_rank === 'pollito_admin');
      const rank = isAdmin ? 'pollito_admin' : (prof?.minecraft_rank || 'pollito_oficial');

      return {
        id: stat.uuid,
        user_id: acc?.user_id || null,
        username: stat.name,
        edition,
        roblox_user: prof?.roblox_user || null,
        roblox_display_name: prof?.roblox_display_name || cleanUsername,
        minecraft_avatar_url: mcAvatarUrl,
        roblox_avatar_url: prof?.roblox_avatar_url || null,
        minecraft_rank: rank,
        is_admin: isAdmin,
        stats: {
          playtime_hours: stat.playtime_hours,
          blocks_mined: stat.blocks_mined,
          diamonds_mined: stat.diamonds_mined,
          mobs_killed: stat.mobs_killed,
          blocks_placed: stat.blocks_placed,
          deaths: stat.deaths,
          distance_km: stat.distance_km,
          jumps: stat.jumps,
          sleeps: stat.sleeps,
        },
      };
    });

    // Sort according to metric
    entries.sort((a, b) => {
      if (metric === 'mining') return b.stats.blocks_mined - a.stats.blocks_mined;
      if (metric === 'diamonds') return b.stats.diamonds_mined - a.stats.diamonds_mined;
      if (metric === 'kills') return b.stats.mobs_killed - a.stats.mobs_killed;
      if (metric === 'building') return b.stats.blocks_placed - a.stats.blocks_placed;
      if (metric === 'deaths') return b.stats.deaths - a.stats.deaths;
      if (metric === 'distance') return b.stats.distance_km - a.stats.distance_km;
      if (metric === 'sleeps') return b.stats.sleeps - a.stats.sleeps;
      return b.stats.playtime_hours - a.stats.playtime_hours;
    });

    // Add rank position
    const ranked = entries.map((entry, idx) => ({
      ...entry,
      position: idx + 1,
    }));

    return NextResponse.json({
      metric,
      total_players: ranked.length,
      leaderboard: ranked,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}