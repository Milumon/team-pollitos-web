/**
 * TikTok Live Realtime Chat Listener for Team Pollito & OBS Overlay
 * 
 * Auto-connects to @milumon_gaming / @milumon_xde
 * Ingests chats in real-time into Supabase `stream_comments`
 * Updates `stream_status` and `stream_sessions`
 */

const { TikTokLiveConnection } = require('d:/GitHub/TikTok-Chat-Reader/node_modules/tiktok-live-connector');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nqzkdjtckvrkcuxyoxkn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const USERNAMES = ['milumon_gaming', 'milumon_xde', 'milumonxde', 'milumon'];
let currentUsernameIndex = 0;
let activeConnection = null;
let streamStartTime = Date.now();

console.log('====================================================');
console.log('🐣 TEAM POLLITO - TIKTOK LIVE REALTIME CHAT LISTENER');
console.log('====================================================');
console.log(`📡 Cuentas monitoreadas: ${USERNAMES.map(u => '@' + u).join(', ')}`);

async function initSession(username) {
  const sessionId = `${new Date().toISOString().slice(0, 10)}_${username}`;
  try {
    await supabase.from('stream_sessions').upsert({
      id: sessionId,
      tiktok_username: username,
      is_active: true,
      started_at: new Date().toISOString(),
    });
    await supabase.from('stream_status').upsert({
      id: 1,
      is_live: true,
      tiktok_username: username,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`✅ Sesión registrada en Supabase: ${sessionId}`);
  } catch (err) {
    console.error('⚠️ Error al registrar sesión:', err.message || err);
  }
  return sessionId;
}

function startListening(username) {
  console.log(`\n🔍 Verificando transmisión en vivo de @${username}...`);

  const conn = new TikTokLiveConnection(username, {
    processInitialData: true,
    enableExtendedGiftInfo: false,
  });

  let currentSessionId = `${new Date().toISOString().slice(0, 10)}_${username}`;

  conn.on('connected', async (state) => {
    console.log(`\n🎉 [CONECTADO] ¡@${username} está EN VIVO! (Room ID: ${state?.roomId || 'Activo'})`);
    activeConnection = conn;
    streamStartTime = Date.now();
    currentSessionId = await initSession(username);
    console.log(`💬 Escuchando y transmitiendo comentarios al overlay de OBS en tiempo real...\n`);
  });

  conn.on('chat', async (msg) => {
    const offsetSec = Number(((Date.now() - streamStartTime) / 1000).toFixed(2));
    const commentText = msg.content || msg.comment || '';
    if (!commentText.trim()) return;

    const user = msg.user || {};
    const identity = msg.userIdentity || {};
    const row = {
      session_id: currentSessionId,
      offset_sec: offsetSec,
      tiktok_user: user.uniqueId || user.secUid || 'anonimo',
      nickname: user.nickname || user.uniqueId || 'Anon',
      message: commentText.trim(),
      avatar_url: user.profilePicture?.urlList?.[0] || null,
      badges: user.badges || [],
      team_member_level: user.teamMemberLevel || 0,
      is_follower: Boolean(identity.isFollowerOfAnchor || (user.followRole && user.followRole >= 1)),
      is_subscriber: Boolean(identity.isSubscriberOfAnchor || user.isSubscriber),
      is_moderator: Boolean(identity.isModeratorOfAnchor || user.isModerator),
    };

    try {
      const { error } = await supabase.from('stream_comments').insert(row);
      if (error) {
        console.error('⚠️ Error al insertar comentario:', error.message);
      } else {
        console.log(`💬 [${row.nickname}]: ${row.message}`);
      }
    } catch (err) {
      console.error('⚠️ Excepción al insertar:', err);
    }
  });

  conn.on('streamEnd', () => {
    console.log(`\n🏁 Directo finalizado para @${username}`);
    activeConnection = null;
    supabase.from('stream_status').update({ is_live: false }).eq('id', 1);
    supabase.from('stream_sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', currentSessionId);
    scheduleNextCheck();
  });

  conn.on('disconnected', () => {
    if (activeConnection === conn) {
      console.log(`⚠️ Desconectado de @${username}. Reintentando en 8s...`);
      activeConnection = null;
      setTimeout(() => startListening(username), 8000);
    }
  });

  conn.connect().catch(() => {
    scheduleNextCheck();
  });
}

function scheduleNextCheck() {
  if (activeConnection) return;
  setTimeout(() => {
    if (!activeConnection) {
      currentUsernameIndex = (currentUsernameIndex + 1) % USERNAMES.length;
      startListening(USERNAMES[currentUsernameIndex]);
    }
  }, 10000);
}

startListening(USERNAMES[0]);
