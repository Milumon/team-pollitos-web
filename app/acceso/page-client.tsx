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
          if (!cancelled) {
            router.replace(retorno);
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
      setError(authError.message);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2D3139] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[28px] border-3 border-[#2D3139] bg-white p-7 shadow-[10px_10px_0_#FFD500] space-y-5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border-3 border-[#2D3139] bg-[#FFD500] text-black">
          {isSyncing ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldAlert className="h-6 w-6" />}
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[#D4A000]">
            Acceso seguro
          </p>
          <h1 className="font-display text-3xl font-bold leading-none">Entrar a la comunidad</h1>
          <p className="text-sm font-semibold text-[#475569]">
            Inicia sesión con Google para volver exactamente a la ruta que solicitaste.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border-3 border-[#2D3139] bg-[#FFF0B8] px-4 py-3 text-xs font-bold text-[#5A4500]">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleLogin}
          disabled={isSyncing}
          className="w-full rounded-2xl border-3 border-[#2D3139] bg-[#FFD500] px-4 py-3 font-display text-sm font-semibold text-black transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-wait disabled:opacity-70"
        >
          {isSyncing ? 'Validando sesión...' : 'Continuar con Google'}
        </button>
      </div>
    </main>
  );
}
