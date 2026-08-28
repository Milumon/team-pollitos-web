import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const vmBaseUrl = process.env.ROBLOX_ALEXA_VM_URL || '';
    if (!vmBaseUrl) {
      return NextResponse.json({ connected: false, reason: 'URL no configurada en las variables de entorno' });
    }

    // Ping rápido a la VM de Roblox (timeout de 2 segundos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      await fetch(vmBaseUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Aunque responda con 404, 403, 401, etc., el servidor está activo.
      return NextResponse.json({ connected: true });
    } catch {
      clearTimeout(timeoutId);
      return NextResponse.json({ connected: false, reason: 'La máquina no responde o está apagada' });
    }
  } catch (error) {
    console.error('[Ping VM Error]:', error);
    return NextResponse.json({ connected: false, error: 'Excepción de red al contactar la máquina' });
  }
}
