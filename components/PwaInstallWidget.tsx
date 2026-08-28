'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Download, ExternalLink, MoreHorizontal, Plus, Share } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'team-pollito-pwa-dismissed-at';
let deferredInstallPrompt: InstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

type Browser = 'safari-ios' | 'chrome-android' | 'samsung-android' | 'chrome-desktop' | 'edge-desktop' | 'brave-desktop' | 'safari-macos' | 'firefox' | 'other';

type InstallEnvironment = {
  browser: Browser;
  inAppBrowser: boolean;
};

export function requestPwaInstall() {
  window.dispatchEvent(new Event('team-pollito:install'));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as InstallPromptEvent;
    promptListeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    promptListeners.forEach((listener) => listener());
  });
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isAppleMobileDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function detectEnvironment(): InstallEnvironment {
  const userAgent = window.navigator.userAgent;
  const isAppleMobile = isAppleMobileDevice();
  const isAndroid = /android/i.test(userAgent);
  const inAppBrowser = /tiktok|musical_ly|instagram|fbav|fban|line\/|discord/i.test(userAgent);

  if (inAppBrowser) return { browser: 'other', inAppBrowser: true };
  if (isAppleMobile && /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent)) return { browser: 'safari-ios', inAppBrowser: false };
  if (isAndroid && /samsungbrowser/i.test(userAgent)) return { browser: 'samsung-android', inAppBrowser: false };
  if (isAndroid && /crmo|chrome/i.test(userAgent) && !/edga|opr\//i.test(userAgent)) return { browser: 'chrome-android', inAppBrowser: false };
  if (/edg\//i.test(userAgent)) return { browser: 'edge-desktop', inAppBrowser: false };
  if (/brave/i.test(userAgent)) return { browser: 'brave-desktop', inAppBrowser: false };
  if (/chrome|crios/i.test(userAgent) && !/edg|opr\//i.test(userAgent)) return { browser: 'chrome-desktop', inAppBrowser: false };
  if (/safari/i.test(userAgent) && !/chrome|crios|android/i.test(userAgent)) return { browser: 'safari-macos', inAppBrowser: false };
  if (/firefox|fxios/i.test(userAgent)) return { browser: 'firefox', inAppBrowser: false };
  return { browser: 'other', inAppBrowser: false };
}

function getGuide(environment: InstallEnvironment) {
  switch (environment.browser) {
    case 'safari-ios':
      return {
        title: 'Safari en iPhone o iPad',
        description: 'Instala Team Pollito desde el menú de Safari:',
        steps: [
          { label: 'Compartir', icon: Share },
          { label: 'Ver más', icon: MoreHorizontal },
          { label: 'Agregar a inicio', icon: Plus },
        ],
      };
    case 'chrome-android':
      return {
        title: 'Chrome en Android',
        description: 'Pulsa el menú de Chrome y elige una de estas opciones:',
        steps: [
          { label: 'Instalar aplicación', icon: Download },
          { label: 'Agregar a pantalla principal', icon: Plus },
        ],
      };
    case 'samsung-android':
      return {
        title: 'Samsung Internet',
        description: 'Abre el menú del navegador y selecciona:',
        steps: [{ label: 'Agregar página a > Pantalla de inicio', icon: Plus }],
      };
    case 'chrome-desktop':
      return {
        title: 'Chrome en computadora',
        description: 'Busca el icono de instalación en la barra de direcciones o abre el menú:',
        steps: [{ label: 'Instalar Team Pollito', icon: Download }],
      };
    case 'edge-desktop':
      return {
        title: 'Microsoft Edge',
        description: 'Abre el menú de Edge y entra en Aplicaciones:',
        steps: [{ label: 'Instalar Team Pollito como aplicación', icon: Download }],
      };
    case 'brave-desktop':
      return {
        title: 'Brave',
        description: 'Abre el menú de Brave y selecciona:',
        steps: [{ label: 'Instalar Team Pollito', icon: Download }],
      };
    case 'safari-macos':
      return {
        title: 'Safari en Mac',
        description: 'En la barra superior de macOS, abre el menú Archivo:',
        steps: [{ label: 'Agregar al Dock', icon: Plus }],
      };
    case 'firefox':
      return {
        title: 'Firefox',
        description: 'Firefox no siempre ofrece instalación PWA. Puedes crear un acceso directo desde el menú del navegador:',
        steps: [{ label: 'Agregar a pantalla de inicio o crear acceso directo', icon: Plus }],
      };
    default:
      return {
        title: 'Tu navegador',
        description: 'Abre el menú del navegador y busca una opción para instalar o agregar esta página a inicio:',
        steps: [{ label: 'Instalar aplicación o agregar a pantalla de inicio', icon: Plus }],
      };
  }
}

export function PwaInstallWidget() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [environment, setEnvironment] = useState<InstallEnvironment | null>(() => (
    typeof window === 'undefined' ? null : detectEnvironment()
  ));
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
    const wasDismissedRecently = Number.isFinite(dismissedAt)
      && dismissedAt > 0
      && Date.now() - dismissedAt < 24 * 60 * 60 * 1000;
    const brave = (window.navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
    if (brave?.isBrave) {
      void brave.isBrave().then((isBrave) => {
        if (isBrave) setEnvironment({ browser: 'brave-desktop', inAppBrowser: false });
      });
    }
    const syncPrompt = () => setInstallPrompt(deferredInstallPrompt);
    const handleInstallRequest = () => {
      window.localStorage.removeItem(DISMISS_KEY);
      setIsOpen(true);
    };
    promptListeners.add(syncPrompt);
    syncPrompt();
    window.addEventListener('team-pollito:install', handleInstallRequest);
    const timer = isStandalone() || wasDismissedRecently
      ? undefined
      : window.setTimeout(() => {
           if (deferredInstallPrompt || !isStandalone()) setIsOpen(true);
        }, 3000);

    return () => {
      if (timer) window.clearTimeout(timer);
      promptListeners.delete(syncPrompt);
      window.removeEventListener('team-pollito:install', handleInstallRequest);
    };
  }, []);

  if (!environment || isStandalone() || !isOpen) return null;

  const guide = getGuide(environment);

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('textarea');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1800);
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setIsOpen(false);
  };

  const install = async () => {
    if (!installPrompt) return;
    setIsInstalling(true);
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsOpen(false);
    } else {
      setInstallPrompt(null);
    }
    setIsInstalling(false);
  };

  return (
    <aside className="fixed inset-x-4 bottom-5 z-[60] mx-auto w-auto max-w-sm rounded-2xl border border-[#eadfbd] bg-white p-4 shadow-[0_16px_40px_rgba(76,59,18,.18)] sm:inset-x-auto sm:right-5 sm:mx-0">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar aviso de instalación"
        className="absolute right-3 top-3 rounded-lg px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
      >
        ×
      </button>
      <div className="flex gap-3 pr-5">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#FFF7D6] shadow-sm">
          <Image src="/icons/team-pollito-icon.png" alt="" width={64} height={64} className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-[#2D3139]">Lleva el Team Pollito contigo</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-gray-500">
            {environment.inAppBrowser ? 'Abre esta página en Safari o Chrome para poder instalarla.' : 'Añade Team Pollito a tu pantalla de inicio para entrar más rápido.'}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-[#FFF9E6] p-3 text-xs font-medium text-[#66552A]">
        <p className="mb-2 font-display font-bold text-[#2D3139]">{guide.title}</p>
        <p className="mb-2 leading-relaxed">{environment.inAppBrowser ? 'Primero copia el enlace y ábrelo en Safari o Chrome.' : guide.description}</p>
        <ol className="space-y-2">
          {guide.steps.map(({ label, icon: Icon }, index) => (
            <li key={label} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white font-bold text-[#D4A000]">{index + 1}</span>
              <Icon className="h-4 w-4 shrink-0 text-[#D4A000]" aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </div>
      {environment.inAppBrowser && (
        <button type="button" onClick={() => void copyLink()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#eadfbd] px-3 py-2 text-xs font-bold text-[#66552A] transition hover:bg-[#FFF9E6]">
          {isCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {isCopied ? 'Enlace copiado' : 'Copiar enlace de Team Pollito'}
        </button>
      )}
      {environment.inAppBrowser && (
        <p className="mt-2 flex items-center gap-1 text-[11px] leading-relaxed text-gray-500">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Pega el enlace en Safari o Chrome.
        </p>
      )}
      <div className="mt-3 flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 transition hover:bg-gray-50">
          Ahora no
        </button>
        {installPrompt && !environment.inAppBrowser && (
          <button type="button" onClick={() => void install()} disabled={isInstalling} className="rounded-lg bg-[#FFC200] px-3 py-2 text-xs font-bold text-black transition hover:brightness-105 disabled:opacity-60">
            {isInstalling ? 'Añadiendo...' : 'Añadir a pantalla de inicio'}
          </button>
        )}
      </div>
    </aside>
  );
}
