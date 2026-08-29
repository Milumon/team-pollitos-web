import { NextRequest, NextResponse } from 'next/server';
import { sendMinecraftDiscordNotification, type MinecraftEventPayload } from '@/lib/discordMinecraft';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.MINECRAFT_BRIDGE_SECRET || 'pollito-mc-secret-2026';

    if (authHeader && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await request.json()) as MinecraftEventPayload;
    if (!body || !body.type || !body.player) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 });
    }

    await sendMinecraftDiscordNotification(body);

    return NextResponse.json({ success: true, message: 'Evento notificado a Discord' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al procesar evento de Minecraft';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
