import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

function getVmConfig() {
  const vmBaseUrl = process.env.ROBLOX_ALEXA_VM_URL || '';
  const vmSecret = process.env.ROBLOX_ALEXA_SHARED_SECRET || '';

  if (!vmBaseUrl || !vmSecret) {
    throw new Error('Faltan ROBLOX_ALEXA_VM_URL o ROBLOX_ALEXA_SHARED_SECRET');
  }

  return { vmBaseUrl: vmBaseUrl.replace(/\/$/, ''), vmSecret };
}

export async function GET(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { vmBaseUrl, vmSecret } = getVmConfig();
    const action = request.nextUrl.searchParams.get('action') || 'status';

    let endpoint = `${vmBaseUrl}/tiktok/status`;
    if (action === 'logs') {
      endpoint = `${vmBaseUrl}/tiktok/logs`;
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-shared-secret': vmSecret,
      },
      cache: 'no-store',
    });

    const payload = await res.text();
    try {
      return NextResponse.json(JSON.parse(payload), { status: res.status });
    } catch {
      return NextResponse.json({ raw: payload }, { status: res.status });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al consultar listener';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action; // 'start' | 'stop'

    if (!['start', 'stop'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida. Usa "start" o "stop".' }, { status: 400 });
    }

    const { vmBaseUrl, vmSecret } = getVmConfig();
    const res = await fetch(`${vmBaseUrl}/tiktok/${action}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-shared-secret': vmSecret,
      },
      body: JSON.stringify({}),
    });

    const payload = await res.text();
    try {
      return NextResponse.json(JSON.parse(payload), { status: res.status });
    } catch {
      return NextResponse.json({ message: payload }, { status: res.status });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al enviar comando al listener';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}