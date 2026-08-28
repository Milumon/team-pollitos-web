'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';

import { normalizeReturnPath } from '@/lib/authRouting';
import { supabase } from '@/lib/supabaseClient';

export default function AccessPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const retorno = normalizeReturnPath(searchParams ? searchParams.get('retorno') : null);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('link_status')
            .eq('id', user.id)
            .maybeSingle();

          if (!cancelled) {
            if (!profile || profile.link_status === 'none') {
              const dest = retorno && retorno !== '/' ? `/unirse?returnTo=${encodeURIComponent(retorno)}` : '/unirse';
              router.replace(dest);
            } else {
              router.replace(retorno);
            }
          }
          return;
        }
      } catch {
        if (!cancelled) {
          setError('No se pudo preparar tu sesión. Intenta nuevamente.');
        }
      }

      if (!cancelled) {
        setIsSyncing(false);
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [retorno, router]);

  const handleLogin = async () => {
    setError(null);
    const redirectTo = `${window.location.origin}/api/auth/callback?retorno=${encodeURIComponent(retorno)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (authError) {
      setError(authError.message || 'No se pudo iniciar sesión con Google.');
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2D3139] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#E8DFC5] rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] text-center space-y-6">
        <div className="space-y-2">
          <span className="text-4xl">🐣</span>
          <h1 className="font-display font-black text-2xl text-[#2D3139]">Acceso a Team Pollito</h1>
          <p className="text-xs text-gray-500 font-semibold">
            Inicia sesión con tu cuenta de Google para identificarte en la comunidad y Minecraft.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2 text-left">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={isSyncing}
          onClick={handleLogin}
          className="w-full py-3.5 px-4 bg-[#FFD500] hover:brightness-105 text-black font-display font-black text-xs rounded-2xl transition cursor-pointer shadow-[3px_3px_0_#D4A000] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando sesión...
            </>
          ) : (
            <>
              <span>Continuar con Google</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-gray-400">
          Si es tu primera vez, serás dirigido automáticamente a completar tu registro.
        </p>
      </div>
    </main>
  );
}
