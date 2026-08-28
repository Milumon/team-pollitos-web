import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const SERVER_ID = 'production';
const STALE_AFTER_MS = 90_000;

type StatusPayload = {
  serverId?: unknown;
  serverVersion?: unknown;
  playerNames?: unknown;
  maxPlayers?: unknown;
  tps?: unknown;
  mspt?: unknown;
};

type MinecraftAccount = {
  user_id: string;
  edition: 'java' | 'bedrock';
  username: string;
  status: string;
};

type Profile = {
  id: string;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
};

type OnlinePlayer = {
  nickname: string | null;
  avatarUrl: string | null;
  java: string | null;
  bedrock: string | null;
};

async function resolveOnlinePlayers(playerNames: string[]): Promise<OnlinePlayer[]> {
  if (playerNames.length === 0) return [];

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('minecraft_accounts')
    .select('user_id, edition, username, status')
    .in('status', ['pending', 'approved']);

  if (accountsError) throw accountsError;

  const normalizeMinecraftName = (name: string) => name.trim().replace(/^\./, '').toLocaleLowerCase();
  const onlineNames = new Set(playerNames.map(normalizeMinecraftName));
  const onlineAccounts = ((accounts ?? []) as MinecraftAccount[]).filter((account) => playerNames.some((playerName) => {
    const isBedrockPlayer = playerName.trim().startsWith('.');
    return isBedrockPlayer === (account.edition === 'bedrock')
      && onlineNames.has(normalizeMinecraftName(account.username))
      && normalizeMinecraftName(playerName) === normalizeMinecraftName(account.username);
  }));
  const userIds = [...new Set(onlineAccounts.map((account) => account.user_id))];
  if (userIds.length === 0) {
    return playerNames.map((name) => {
      const username = name.trim().replace(/^\./, '');
      return name.trim().startsWith('.')
        ? { nickname: null, avatarUrl: null, java: null, bedrock: username }
        : { nickname: null, avatarUrl: null, java: username, bedrock: null };
    });
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, roblox_display_name, roblox_avatar_url')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const profilesById = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const players = userIds.map((userId) => {
    const profile = profilesById.get(userId);
    const accountsForUser = onlineAccounts.filter((account) => account.user_id === userId);
    return {
      nickname: profile?.roblox_display_name?.trim() || null,
      avatarUrl: profile?.roblox_avatar_url || null,
      java: accountsForUser.find((account) => account.edition === 'java')?.username ?? null,
      bedrock: accountsForUser.find((account) => account.edition === 'bedrock')?.username ?? null,
    };
  });

  const matchedNames = new Set(onlineAccounts.map((account) => `${account.edition}:${normalizeMinecraftName(account.username)}`));
  const fallbackPlayers = playerNames
    .filter((name) => {
      const edition = name.trim().startsWith('.') ? 'bedrock' : 'java';
      return !matchedNames.has(`${edition}:${normalizeMinecraftName(name)}`);
    })
    .map((name) => {
      const username = name.trim().replace(/^\./, '');
      return name.trim().startsWith('.')
        ? { nickname: null, avatarUrl: null, java: null, bedrock: username }
        : { nickname: null, avatarUrl: null, java: username, bedrock: null };
    });

  return [...players, ...fallbackPlayers];
}

function isValidPlayerNames(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= 100
    && value.every((name) => typeof name === 'string' && name.trim().length > 0 && name.length <= 32);
}

function hasBridgeAccess(request: NextRequest): boolean {
  const expected = process.env.MINECRAFT_BRIDGE_TOKEN;
  const received = request.headers.get('x-minecraft-bridge-token');
  return Boolean(expected && received && received === expected);
}

function asFiniteNumber(value: unknown, fallback: number | null = null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('minecraft_server_status')
    .select('server_id, status, server_version, player_names, player_count, max_players, tps, mspt, last_heartbeat_at, updated_at')
    .eq('server_id', SERVER_ID)
    .maybeSingle();

  if (error) {
    console.error('[Minecraft status GET]:', error.message);
    return NextResponse.json({ error: 'No se pudo consultar el estado del servidor.' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      serverId: SERVER_ID,
      status: 'unknown',
      stale: true,
      lastHeartbeatAt: null,
    });
  }

  const lastHeartbeatTime = new Date(data.last_heartbeat_at).getTime();
  const stale = !Number.isFinite(lastHeartbeatTime) || Date.now() - lastHeartbeatTime > STALE_AFTER_MS;

  let players: OnlinePlayer[] = [];
  try {
    players = await resolveOnlinePlayers(Array.isArray(data.player_names) ? data.player_names : []);
  } catch (resolveError) {
    console.error('[Minecraft status players GET]:', resolveError);
  }

  return NextResponse.json({
    serverId: data.server_id,
    status: stale ? 'offline' : data.status,
    stale,
    serverVersion: data.server_version,
    playerNames: Array.isArray(data.player_names) ? data.player_names : [],
    players,
    playerCount: data.player_count,
    maxPlayers: data.max_players,
    tps: data.tps,
    mspt: data.mspt,
    lastHeartbeatAt: data.last_heartbeat_at,
    updatedAt: data.updated_at,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (!hasBridgeAccess(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: StatusPayload;
  try {
    body = await request.json() as StatusPayload;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const serverVersion = typeof body.serverVersion === 'string' ? body.serverVersion.trim() : '';
  const playerNames = body.playerNames;
  const maxPlayers = asFiniteNumber(body.maxPlayers);
  const tps = asFiniteNumber(body.tps);
  const mspt = asFiniteNumber(body.mspt);

  if (body.serverId !== SERVER_ID || !serverVersion || !isValidPlayerNames(playerNames)) {
    return NextResponse.json({ error: 'Payload de estado inválido' }, { status: 400 });
  }

  if (maxPlayers === null || maxPlayers < 1 || maxPlayers > 200 || tps === null || tps < 0 || tps > 20 || mspt === null || mspt < 0) {
    return NextResponse.json({ error: 'Métricas de servidor inválidas' }, { status: 400 });
  }

  if (playerNames.length > maxPlayers) {
    return NextResponse.json({ error: 'La lista de jugadores supera la capacidad del servidor' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('minecraft_server_status')
    .upsert({
      server_id: SERVER_ID,
      status: 'online',
      server_version: serverVersion,
      player_names: playerNames.map((name) => name.trim()),
      player_count: playerNames.length,
      max_players: maxPlayers,
      tps,
      mspt,
      last_heartbeat_at: now,
      updated_at: now,
    }, { onConflict: 'server_id' });

  if (error) {
    console.error('[Minecraft status POST]:', error.message);
    return NextResponse.json({ error: 'No se pudo guardar el estado.' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
