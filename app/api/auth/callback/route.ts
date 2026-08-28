import { NextRequest, NextResponse } from 'next/server';

import { buildAccessPath, normalizeReturnPath } from '@/lib/authRouting';
import { createRouteHandlerSupabaseClient } from '@/lib/serverSession';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const retorno = normalizeReturnPath(request.nextUrl.searchParams.get('retorno'));
  const origin = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
    : request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL(buildAccessPath(retorno), origin));
  }

  const response = NextResponse.redirect(new URL(retorno, origin));
  const supabase = createRouteHandlerSupabaseClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    response.headers.set('location', new URL(buildAccessPath(retorno), origin).toString());
    return response;
  }

  // Check if new/unconfigured member needs onboarding
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('link_status')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.link_status === 'none') {
      const dest = retorno && retorno !== '/' ? `/unirse?returnTo=${encodeURIComponent(retorno)}` : '/unirse';
      response.headers.set('location', new URL(dest, origin).toString());
    }
  }

  return response;
}
