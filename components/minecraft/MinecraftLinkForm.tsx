'use client';

import { FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/ui/Header';
import { NavBar } from '@/components/ui/NavBar';

type Account = {
  id: string;
  edition: 'java' | 'bedrock';
  username: string;
  player_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  rejection_reason: string | null;
  verified_at: string | null;
  approved_at?: string | null;
  created_at?: string;
  code?: string | null;
  link_code_expires_at?: string | null;
};

const steps = ['Tu cuenta', 'Solicita', 'Conéctate', 'Confirma', 'Listo'];

function isVerified(account: Account | null) {
  return Boolean(account?.verified_at && account.status === 'approved');
}

export default function MinecraftLinkForm() {
  const [edition, setEdition] = useState<'java' | 'bedrock'>('java');
  const [username, setUsername] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ipCopied, setIpCopied] = useState(false);
  const [codeExpired, setCodeExpired] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [replacingExisting, setReplacingExisting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const formHasChanges = useRef(false);

  useEffect(() => {
    let active = true;
    const loadAccount = async () => {
      try {
        const response = await fetch('/api/minecraft/link', { cache: 'no-store' });
        const payload = await response.json() as { accounts?: Account[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la vinculación.');
        if (!active) return;
        const accounts = payload.accounts ?? [];
        const current = accounts.find((item) => item.edition === edition) ?? accounts[0] ?? null;
        setAccounts(accounts);
        setAccount(current);
        if (formHasChanges.current) return;
        if (!formHasChanges.current && current?.username) setUsername(current.username);
        if (!formHasChanges.current && current?.edition) setEdition(current.edition);
        if (current?.code && !isVerified(current)) {
          setCode(current.code);
          setExpiresAt(current.link_code_expires_at ?? null);
          setCodeExpired(false);
        }
        if (isVerified(current)) {
          setReplaceMode(false);
          setReplacingExisting(false);
          setCode(null);
          setStep(5);
        } else if (!replaceMode && current?.code) {
          setStep((current.verified_at ? 4 : 3));
        }
        if (!replaceMode && current?.status === 'pending' && current.link_code_expires_at && !current.code && new Date(current.link_code_expires_at).getTime() < Date.now()) {
          setCode(null);
          setExpiresAt(null);
          setCodeExpired(true);
          setStep(1);
          setMessage(null);
        }
      } catch (error: unknown) {
        if (active && !account) setMessage(error instanceof Error ? error.message : 'No se pudo cargar la vinculación.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadAccount();
    const interval = window.setInterval(loadAccount, code ? 4000 : 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [code, replaceMode, step, edition]);

  useEffect(() => {
    if (!code || !expiresAt) return;

    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) {
        setCode(null);
        setExpiresAt(null);
        setCodeExpired(true);
        setStep(1);
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [code, expiresAt]);

  const requestCode = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/minecraft/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition, username, playerId: '' }),
      });
      const payload = await response.json() as { account?: Account; code?: string; expiresAt?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'No se pudo crear la solicitud.');
      const nextAccount = payload.account ?? null;
      setAccount(nextAccount);
      if (nextAccount) setAccounts((current) => [...current.filter((item) => item.edition !== nextAccount.edition), nextAccount]);
      setCode(payload.code ?? null);
      setExpiresAt(payload.expiresAt ?? null);
      setCodeExpired(false);
      formHasChanges.current = false;
      setReplacingExisting(false);
      setStep(3);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await requestCode();
  };

  const copyCommand = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(`/link ${code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const copyIp = async () => {
    await navigator.clipboard.writeText('mc.milumon.dev');
    setIpCopied(true);
    window.setTimeout(() => setIpCopied(false), 2200);
  };

  const beginLink = (targetEdition: 'java' | 'bedrock', replaceExisting: boolean) => {
    const existingAccount = accounts.find((item) => item.edition === targetEdition);
    setEdition(targetEdition);
    setUsername(existingAccount?.username ?? '');
    setReplaceMode(true);
    setReplacingExisting(replaceExisting);
    setCode(null);
    setCodeExpired(false);
    formHasChanges.current = true;
    setStep(1);
    setMessage(null);
  };

  const editAccount = () => {
    setCode(null);
    setExpiresAt(null);
    setRemainingSeconds(null);
    setCodeExpired(false);
    formHasChanges.current = true;
    setStep(1);
    setMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D3139] selection:bg-[#FFB000] selection:text-black">
      <Header session={null} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <NavBar variant="drawer" isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-8 sm:py-16">
        <div className="mb-8 flex items-center gap-3">
          <span className="text-4xl">🐣</span>
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-[#D4A000]">Minecraft · Team Pollito</p>
            <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-[#2D3139] sm:text-4xl">Vincula tu cuenta</h1>
          </div>
        </div>

        {!replaceMode && account && isVerified(account) ? (
          <SuccessCard accounts={accounts} onLink={beginLink} />
        ) : loading ? (
          <p className="text-[#64748B]">Cargando tu aventura...</p>
        ) : (
          <>
            <Progress current={step} />
            {codeExpired && <ExpiredCard saving={saving} onRegenerate={requestCode} />}
            {replaceMode && replacingExisting && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-[#FFF7DC] p-4 text-sm font-medium text-[#7A6330]">
                Estás cambiando esta cuenta. La vinculación anterior dejará de funcionar cuando completes este proceso.
              </div>
            )}
            {step === 1 && (
              <StepOne
                edition={edition}
                setEdition={(value) => { formHasChanges.current = true; setEdition(value); }}
                username={username}
                setUsername={(value) => { formHasChanges.current = true; setUsername(value); }}
                onNext={() => { setMessage(null); setStep(2); }}
              />
            )}
            {step === 2 && (
              <StepTwo
                edition={edition}
                username={username}
                saving={saving}
                onBack={() => setStep(1)}
                onSubmit={submit}
              />
            )}
            {step === 3 && code && (
              <StepThree
                edition={edition}
                username={username}
                code={code}
                expiresAt={expiresAt}
                remainingSeconds={remainingSeconds}
                saving={saving}
                onNext={() => setStep(4)}
                onBack={editAccount}
                onRegenerate={requestCode}
                onCopy={copyCommand}
                copied={copied}
                onCopyIp={copyIp}
                ipCopied={ipCopied}
              />
            )}
            {step === 4 && code && (
              <StepFour
                code={code}
                saving={saving}
                onBack={editAccount}
                onRegenerate={requestCode}
                onCopy={copyCommand}
                copied={copied}
                message={message}
              />
            )}
            {message && <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{message}</p>}
          </>
        )}
      </main>
    </div>
  );
}

function Progress({ current }: Readonly<{ current: number }>) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex justify-between text-xs font-bold text-[#9A8D70]">
        <span>Paso {current} de 5</span>
        <span>{steps[current - 1]}</span>
      </div>
      <div className="flex gap-2">
        {steps.map((label, index) => (
          <div key={label} className={`h-2.5 flex-1 rounded-full ${index < current ? 'bg-[#FFD500]' : 'bg-[#E8DFC5]'}`} aria-label={label} />
        ))}
      </div>
    </div>
  );
}

function StepOne({ edition, setEdition, username, setUsername, onNext }: Readonly<{ edition: 'java' | 'bedrock'; setEdition: (value: 'java' | 'bedrock') => void; username: string; setUsername: (value: string) => void; onNext: () => void }>) {
  return (
    <Card title="Datos de tu cuenta" icon="🥚">
      <p className="text-sm font-medium text-[#64748B]">Selecciona tu plataforma e ingresa tu nombre exacto de Minecraft.</p>
      
      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#45413A] mb-2">Plataforma</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEdition('java')}
              className={`p-3.5 rounded-xl border-2 text-left font-display transition-all cursor-pointer ${
                edition === 'java'
                  ? 'border-[#FFD500] bg-[#FFF9E6] shadow-sm ring-1 ring-[#FFD500]'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="text-lg block">☕</span>
              <p className="font-bold text-sm text-[#2D3139] mt-1">Java Edition</p>
              <p className="text-[11px] text-gray-500 font-sans">PC / Mac / Linux</p>
            </button>

            <button
              type="button"
              onClick={() => setEdition('bedrock')}
              className={`p-3.5 rounded-xl border-2 text-left font-display transition-all cursor-pointer ${
                edition === 'bedrock'
                  ? 'border-[#FFD500] bg-[#FFF9E6] shadow-sm ring-1 ring-[#FFD500]'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="text-lg block">📱</span>
              <p className="font-bold text-sm text-[#2D3139] mt-1">Bedrock Edition</p>
              <p className="text-[11px] text-gray-500 font-sans">Celular, Consolas, Win 10</p>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#45413A] mb-1">Tu nombre de usuario</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            maxLength={32}
            className="w-full rounded-xl border border-[#E8DFC5] bg-[#FFFDF5] px-4 py-3 text-base font-semibold text-[#2D3139] focus:outline-none focus:ring-2 focus:ring-[#FFD500]"
            placeholder={edition === 'bedrock' ? 'Ejemplo: TuGamertag' : 'Ejemplo: TuNickJava'}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!username.trim()}
        className="mt-6 w-full rounded-xl bg-[#FFD500] hover:brightness-105 px-5 py-3 font-display font-black text-black transition-all disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        Continuar ✨
      </button>
    </Card>
  );
}

function StepTwo({ edition, username, saving, onBack, onSubmit }: Readonly<{ edition: string; username: string; saving: boolean; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }>) {
  const isJava = edition === 'java';
  return (
    <Card title="Confirma tu solicitud" icon="🎟️">
      <div className="rounded-2xl bg-[#FFF9E6] border border-[#FFD500]/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[#9A8D70]">Cuenta a vincular</p>
            <p className="mt-1 text-xl font-black text-[#2D3139] font-mono">{username}</p>
          </div>
          <span className="text-xs font-display font-bold px-3 py-1 bg-white border border-[#FFD500] rounded-full text-[#7A6330]">
            {isJava ? '☕ Java' : '📱 Bedrock'}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium leading-relaxed text-[#64748B]">
        Generaremos un código único temporal para que ingreses al servidor y completes la vinculación en segundos.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-[#E8DFC5] bg-white hover:bg-gray-50 px-5 py-3 font-display font-bold text-[#64748B] cursor-pointer"
        >
          Atrás
        </button>
        <button
          disabled={saving}
          className="flex-1 rounded-xl bg-[#FFD500] hover:brightness-105 px-5 py-3 font-display font-black text-black transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Generando código...' : 'Obtener código de vinculación'}
        </button>
      </form>
    </Card>
  );
}

function StepThree({
  edition,
  username,
  code,
  expiresAt,
  remainingSeconds,
  saving,
  onNext,
  onBack,
  onRegenerate,
  onCopy,
  copied,
  onCopyIp,
  ipCopied,
}: Readonly<{
  edition: 'java' | 'bedrock';
  username: string;
  code: string;
  expiresAt: string | null;
  remainingSeconds: number | null;
  saving: boolean;
  onNext: () => void;
  onBack: () => void;
  onRegenerate: () => void;
  onCopy: () => void;
  copied: boolean;
  onCopyIp: () => void;
  ipCopied: boolean;
}>) {
  const isJava = edition === 'java';
  const countdown = remainingSeconds === null ? '10 minutos' : remainingSeconds >= 60 ? `${Math.ceil(remainingSeconds / 60)} min` : `${remainingSeconds}s`;

  return (
    <Card title="Entra al servidor y escribe el comando" icon="⚡">
      {/* Banner de Plataforma */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-4">
        <span className="font-display font-bold text-xs text-gray-700">
          {isJava ? '☕ Plataforma: Minecraft Java' : '📱 Plataforma: Minecraft Bedrock'}
        </span>
        <span className="text-xs font-mono font-bold text-[#2D3139]">@{username}</span>
      </div>

      {/* 1. Dirección del Servidor */}
      <div className="rounded-xl border border-[#E8DFC5] bg-[#FFFDF5] p-3.5 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Dirección del Servidor</p>
            <p className="font-mono text-base font-black text-[#2D3139]">mc.milumon.dev</p>
          </div>
          <button
            type="button"
            onClick={onCopyIp}
            className="rounded-lg bg-[#FFD500] hover:brightness-105 px-3 py-1.5 text-xs font-display font-black text-black transition-all cursor-pointer shrink-0"
          >
            {ipCopied ? '✅ ¡Copiada!' : 'Copiar IP'}
          </button>
        </div>
      </div>

      {/* 2. Comando a escribir */}
      <div className="rounded-2xl border-2 border-emerald-400 bg-[#ECFDF3] p-4 text-center space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
          Escribe este comando en el chat de Minecraft:
        </p>
        <div className="bg-white border border-emerald-200 rounded-xl py-2 px-3 font-mono text-2xl font-black tracking-wider text-emerald-800">
          /link {code}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 font-display font-bold text-sm transition-all cursor-pointer"
        >
          {copied ? '✅ ¡Comando Copiado!' : '📋 Copiar comando /link'}
        </button>
      </div>

      {/* Pasos rápidos */}
      <div className="mt-4 bg-white border border-gray-100 rounded-xl p-3 space-y-1.5 text-xs font-sans text-gray-600">
        <p><strong>1.</strong> Entra a <strong>mc.milumon.dev</strong> en Minecraft.</p>
        <p><strong>2.</strong> Abre el chat (tecla <strong>T</strong>) y envía <strong>/link {code}</strong>.</p>
        <p><strong>3.</strong> ¡Listo! Tu cuenta se vinculará de inmediato.</p>
      </div>

      {/* Temporizador */}
      <p className="mt-4 text-center text-xs font-bold text-amber-700">
        ⏰ Código válido por {countdown} (vence a las {expiresAt ? new Date(expiresAt).toLocaleTimeString('es-PE') : 'pronto'}).
      </p>

      {/* Botones de acción */}
      <button
        type="button"
        onClick={onNext}
        className="mt-5 w-full rounded-xl bg-[#FFD500] hover:brightness-105 px-5 py-3 font-display font-black text-black transition-all cursor-pointer"
      >
        Ya escribí /link en el chat ✅
      </button>

      <div className="flex gap-2 mt-2.5">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={saving}
          className="flex-1 rounded-xl border border-amber-200 bg-[#FFF7DC] hover:bg-[#ffefc4] py-2 text-xs font-display font-bold text-amber-900 transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Generando...' : '⚠️ Generar otro código'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-[#E8DFC5] bg-white hover:bg-gray-50 py-2 text-xs font-display font-bold text-gray-600 transition-all cursor-pointer"
        >
          ✏️ Cambiar usuario
        </button>
      </div>
    </Card>
  );
}

function ExpiredCard({ saving, onRegenerate }: Readonly<{ saving: boolean; onRegenerate: () => void }>) {
  return (
    <section className="mb-6 rounded-3xl border-2 border-orange-300 bg-[#FFF7DC] p-6 shadow-[7px_7px_0_#FCD34D] sm:p-8">
      <div className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden>⏰</span>
        <h2 className="font-display text-2xl font-black text-[#7A4A00]">Tu código ya venció</h2>
      </div>
      <p className="mt-4 text-sm font-medium leading-relaxed text-[#7A6330]">
        No pasa nada: tu cuenta sigue registrada. Genera un código nuevo y úsalo en el chat de Minecraft.
      </p>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={saving}
        className="mt-5 w-full rounded-xl bg-[#FFD500] hover:brightness-105 px-5 py-3.5 font-display font-black text-black transition-all disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        {saving ? 'Generando...' : 'Generar un código nuevo'}
      </button>
    </section>
  );
}

function StepFour({ code, saving, onBack, onRegenerate, onCopy, copied, message }: Readonly<{ code: string; saving: boolean; onBack: () => void; onRegenerate: () => void; onCopy: () => void; copied: boolean; message: string | null }>) {
  return (
    <Card title="Comprobando vinculación" icon="🔎">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-[#FFF7DC] text-3xl">
          🐣
        </div>
        <p className="mt-4 text-base font-bold text-[#2D3139]">Esperando confirmación del servidor</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748B]">
          Si aún no lo hiciste, envía este comando en el chat de Minecraft:
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-300 bg-[#ECFDF3] p-3 text-center">
        <p className="font-mono text-xl font-black text-emerald-800">/link {code}</p>
        <button
          type="button"
          onClick={onCopy}
          className="mt-2 text-xs font-display font-bold text-emerald-700 underline cursor-pointer"
        >
          {copied ? '✅ ¡Copiado!' : 'Copiar comando'}
        </button>
      </div>

      <p className="mt-4 text-center text-xs font-medium text-[#9A8D70]">{message || 'Detectando cuando ejecutes /link...'}</p>

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={saving}
          className="flex-1 rounded-xl border border-amber-200 bg-[#FFF7DC] hover:bg-[#ffefc4] py-2 text-xs font-display font-bold text-amber-900 transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Generando...' : '⚠️ Generar otro código'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-[#E8DFC5] bg-white hover:bg-gray-50 py-2 text-xs font-display font-bold text-gray-600 transition-all cursor-pointer"
        >
          ✏️ Cambiar usuario
        </button>
      </div>
    </Card>
  );
}

function Card({ title, icon, children }: Readonly<{ title: string; icon: string; children: ReactNode }>) {
  return (
    <section className="rounded-3xl border-2 border-[#FFD500] bg-white p-6 shadow-[7px_7px_0_#FFDFA0] sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl" aria-hidden>{icon}</span>
        <h2 className="font-display text-2xl font-black text-[#2D3139]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SuccessCard({ accounts, onLink }: Readonly<{ accounts: Account[]; onLink: (edition: 'java' | 'bedrock', replaceExisting: boolean) => void }>) {
  return (
    <section className="rounded-3xl border-2 border-emerald-300 bg-white p-6 shadow-[7px_7px_0_#A7F3D0] sm:p-10">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#FFF7DC] text-4xl">
          🐣
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-600">Tus cuentas de Minecraft</p>
        <h2 className="mt-1 font-display text-2xl font-black text-[#2D3139]">¡Todo listo! 🎉</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[#64748B]">
          Tu cuenta está vinculada y con acceso activo al servidor.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {(['java', 'bedrock'] as const).map((edition) => {
          const linkedAccount = accounts.find((account) => account.edition === edition && isVerified(account));
          const label = edition === 'java' ? '☕ Minecraft Java' : '📱 Minecraft Bedrock';
          return (
            <div key={edition} className="rounded-2xl border border-[#E8DFC5] bg-[#FFFDF5] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-left">
                  <p className="font-black text-[#2D3139] font-display text-sm">{label}</p>
                  {linkedAccount ? (
                    <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                      {linkedAccount.username} · Activa ✅
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-[#9A8D70]">Todavía no vinculada</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onLink(edition, Boolean(linkedAccount))}
                  className="shrink-0 rounded-xl bg-[#FFD500] hover:brightness-105 px-3.5 py-2 text-xs font-display font-black text-black cursor-pointer"
                >
                  {linkedAccount ? 'Cambiar' : 'Vincular'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
