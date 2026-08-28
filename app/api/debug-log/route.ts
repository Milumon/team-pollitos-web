import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[CLIENT LOG]', body.level || 'INFO', ':', body.message, body.data || '');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to log' }, { status: 400 });
  }
}
