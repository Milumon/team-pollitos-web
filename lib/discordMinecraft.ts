const DISCORD_WEBHOOK = process.env.DISCORD_MINECRAFT_WEBHOOK_URL;

export type MinecraftEventPayload = {
  type: 'death' | 'join' | 'leave' | 'advancement' | 'whitelist' | 'daily_top' | 'boss';
  player: string;
  edition?: 'java' | 'bedrock';
  details?: string;
  rank?: string;
  topList?: Array<{ rank: number; name: string; score: string }>;
};

export async function sendMinecraftDiscordNotification(event: MinecraftEventPayload) {
  if (!DISCORD_WEBHOOK) return;

  let embed: Record<string, unknown> = {};

  switch (event.type) {
    case 'death':
      embed = {
        title: '💀 Muerte en el Servidor',
        description: `**${event.player}** ${event.details || 'falleció en el mundo.'}`,
        color: 0xE74C3C, // Red
        footer: { text: 'Minecraft Team Pollito · Servidor Survival' },
        timestamp: new Date().toISOString(),
      };
      break;

    case 'join':
      embed = {
        title: '🟢 Jugador Conectado',
        description: `**${event.player}** se unió al servidor ${event.edition ? `(${event.edition === 'java' ? '☕ Java' : '📱 Bedrock'})` : ''}.`,
        color: 0x2ECC71, // Green
        footer: { text: 'Minecraft Team Pollito' },
        timestamp: new Date().toISOString(),
      };
      break;

    case 'leave':
      embed = {
        title: '🚪 Jugador Desconectado',
        description: `**${event.player}** salió del servidor.`,
        color: 0x95A5A6, // Gray
        footer: { text: 'Minecraft Team Pollito' },
        timestamp: new Date().toISOString(),
      };
      break;

    case 'advancement':
      embed = {
        title: '🏆 ¡Logro Desbloqueado!',
        description: `**${event.player}** completó el desafío:
**[${event.details || 'Logro Épico'}]** ✨`,
        color: 0xF1C40F, // Yellow / Gold
        footer: { text: 'Minecraft Team Pollito · Logros' },
        timestamp: new Date().toISOString(),
      };
      break;

    case 'boss':
      embed = {
        title: '⚔️ ¡Alerta de Jefe en el Servidor!',
        description: `**${event.player}** ${event.details || 'ha comenzado un combate contra un Jefe'} 🐉`,
        color: 0x9B59B6, // Purple
        footer: { text: 'Minecraft Team Pollito · Eventos' },
        timestamp: new Date().toISOString(),
      };
      break;

    case 'whitelist':
      embed = {
        title: '👑 Nuevo Miembro en la Whitelist',
        description: `🎉 ¡Bienvenido **${event.player}**!
Cuenta autorizada como **${event.rank || 'Pollito Oficial'}** ${event.edition ? `(${event.edition === 'java' ? '☕ Java' : '📱 Bedrock'})` : ''}.`,
        color: 0xFFD500, // Team Pollito Brand Gold
        footer: { text: 'Team Pollito · Onboarding de Comunidad' },
        timestamp: new Date().toISOString(),
      };
      break;

    case 'daily_top':
      const listText = (event.topList || [])
        .map((t) => `${t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : '🔹'} **#${t.rank} ${t.name}** — ${t.score}`)
        .join('\n');

      embed = {
        title: '📊 TOP DIARIO · JUGADORES MÁS ACTIVOS DE MINECRAFT',
        description: `Los miembros más destacados del servidor de hoy:

${listText || 'Sin datos de actividad hoy.'}`,
        color: 0xFFD500,
        footer: { text: 'Resumen Diario Oficial · Team Pollito' },
        timestamp: new Date().toISOString(),
      };
      break;
  }

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Minecraft Team Pollito ⛏️',
        avatar_url: 'https://nqzkdjtckvrkcuxyoxkn.supabase.co/storage/v1/object/public/assets/pollito-avatar.png',
        embeds: [embed],
      }),
    });
  } catch (err) {
    console.error('[Discord Minecraft Webhook Error]:', err);
  }
}
