import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: 'limit debe ser un entero entre 1 y 100' }, { status: 400 });
  }

  const { data: batches, error: batchesError } = await supabaseAdmin
    .from('tiktok_ranking_batches')
    .select('id,captured_at')
    .order('captured_at', { ascending: false })
    .limit(limit * 2);

  if (batchesError) {
    console.error('[TikTok snapshots GET error]:', batchesError);
    return NextResponse.json({ error: 'No se pudieron cargar los snapshots' }, { status: 500 });
  }

  const batchIds = (batches ?? []).map((batch) => batch.id);
  const { data: sets, error: setsError } = batchIds.length
    ? await supabaseAdmin.from('tiktok_ranking_sets').select('batch_id,metric,period').in('batch_id', batchIds)
    : { data: [], error: null };
  if (setsError) return NextResponse.json({ error: 'No se pudieron cargar los snapshots' }, { status: 500 });

  const completeBatchIds = (sets ?? []).reduce(
    (counts, set) => counts.set(set.batch_id, (counts.get(set.batch_id) ?? 0) + 1),
    new Map<string, number>(),
  );
  const snapshots = (batches ?? []).filter((batch) => completeBatchIds.get(batch.id) === 8).slice(0, limit);

  return NextResponse.json({ snapshots }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
