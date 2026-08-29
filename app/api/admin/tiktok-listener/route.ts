import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function getVmConfig() {
  const vmBaseUrl = process.env.ROBLOX_ALEXA_VM_URL || '';
  const vmSecret = process.env.ROBLOX_ALEXA_SHARED_SECRET || '';

  if (!vmBaseUrl || !vmSecret) {
    return null;
  }

  return { vmBaseUrl: vmBaseUrl.replace(/\/$/, ''), vmSecret };
}

export async function GET(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1. Check Supabase stream_status
    const { data: streamStatus } = await supabaseAdmin
      .from('stream_status')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const vm = getVmConfig();
    const action = request.nextUrl.searchParams.get('action') || 'status';

    if (vm) {
      try {
        let endpoint = `${vm.vmBaseUrl}/tiktok/status`;
        if (action === 'logs') {
          endpoint = `${vm.vmBaseUrl}/tiktok/logs`;
        }

        const res = await fetch(endpoint, {
          method: 'GET',
          headers: { 'x-shared-secret': vm.vmSecret },
          cache: 'no-store',
          signal: AbortSignal.timeout(2500),
        });

        if (res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload && typeof payload === 'object') {
            return NextResponse.json(payload);
          }
        }
      } catch (vmErr) {
        // Fallback silently to Supabase stream_status
      }
    }

    const isLive = Boolean(streamStatus?.is_live);
    return NextResponse.json({
      running: isLive,
      status: isLive ? 'online' : 'offline',
      username: streamStatus?.tiktok_username || null,
      stream_title: streamStatus?.stream_title || null,
      started_at: streamStatus?.started_at || null,
      viewer_count: streamStatus?.viewer_count || 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al consultar listener';
    return NextResponse.json({ running: false, status: 'offline', error: msg });
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

    const isStarting = action === 'start';
    const vm = getVmConfig();

    if (vm) {
      try {
        await fetch(`${vm.vmBaseUrl}/tiktok/${action}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shared-secret': vm.vmSecret,
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(3000),
        });
      } catch (vmErr) {
        console.warn('VM command failed, updating DB state locally:', vmErr);
      }
    }

    // Update Supabase stream_status directly
    await supabaseAdmin
      .from('stream_status')
      .upsert({
        id: 1,
        is_live: isStarting,
        updated_at: new Date().toISOString(),
        started_at: isStarting ? new Date().toISOString() : null,
      });

    return NextResponse.json({
      success: true,
      running: isStarting,
      status: isStarting ? 'online' : 'offline',
      message: isStarting ? 'Listener iniciado con éxito' : 'Listener detenido',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al procesar acción';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
