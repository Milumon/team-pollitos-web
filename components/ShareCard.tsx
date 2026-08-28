"use client";

import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { VoteState } from '../src/types';
import { soundManager } from '../lib/sound';
import { Share2, Check, Download } from 'lucide-react';
import { BALLOT_LAYOUT } from '../src/config/ballotLayout';

type ShareProfile = {
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
} | null;

interface ShareCardProps {
  votes: VoteState;
  robloxProfile: ShareProfile;
  nominees: Array<{
    id: string;
    name: string;
    profileImageUrl: string | null;
  }>;
}

// Helper: load an image from URL with CORS, returns null on failure
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Helper: draw circular clipped image
function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number, cy: number, radius: number,
  fallbackEmoji: string, fallbackSize: number,
  borderWidth: number, borderColor: string
) {
  // Border
  ctx.beginPath();
  ctx.arc(cx, cy, radius + borderWidth, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();

  // Background
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#f5f5f5';
  ctx.fill();

  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  } else {
    ctx.font = `${fallbackSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackEmoji, cx, cy);
  }
}

// Helper: word wrap text
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function generateStoryCanvas(
  ballotOwnerName: string,
  ballotOwnerHandle: string | null,
  voterAvatarUrl: string | null,
  mvpName: string,
  mvpAvatarUrl: string | null,
): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const DEBUG_MODE = false; // Desactivar modo debug para las descargas de producción

  console.log('DEBUG: generateStoryCanvas URLs:', { voterAvatarUrl, mvpAvatarUrl });

  // Cargar imágenes y la plantilla en paralelo
  const [voterImg, mvpImg, template] = await Promise.all([
    voterAvatarUrl ? loadImage(voterAvatarUrl) : Promise.resolve(null),
    mvpAvatarUrl ? loadImage(mvpAvatarUrl) : Promise.resolve(null),
    loadImage('/story-templates/Plantilla.png'),
  ]);

  console.log('DEBUG: generateStoryCanvas loaded images:', {
    voterLoaded: !!voterImg,
    mvpLoaded: !!mvpImg,
    templateLoaded: !!template
  });

  // ── Dibujar plantilla de fondo ──
  if (template) {
    ctx.drawImage(template, 0, 0, W, H);
  } else {
    // Fallback si la plantilla falla
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(0, 0, W, H);
  }

  // Radios fijos definidos por la calibración final
  const userRadius = BALLOT_LAYOUT.userAvatar.radius;
  const mvpRadius = BALLOT_LAYOUT.mvpAvatar.radius;

  // ── Avatar del usuario ──
  drawCircularImage(
    ctx,
    voterImg,
    BALLOT_LAYOUT.userAvatar.x,
    BALLOT_LAYOUT.userAvatar.y,
    userRadius,
    '👑',
    userRadius * 0.8,
    0,
    'rgba(0,0,0,0)'
  );

  // ── Username del usuario (reducido a 40px) ──
  const voterLabel = ballotOwnerHandle || ballotOwnerName;
  const usernameFontFamily = BALLOT_LAYOUT.username.fontFamily || 'Anton';
  const usernameWeight = usernameFontFamily.toLowerCase().includes('anton') ? '400' : '800';
  ctx.font = `${usernameWeight} ${BALLOT_LAYOUT.username.fontSize || 40}px "${usernameFontFamily}", sans-serif`;
  ctx.fillStyle = BALLOT_LAYOUT.username.color || '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(voterLabel, BALLOT_LAYOUT.username.x, BALLOT_LAYOUT.username.y);

  // ── Avatar de MVP ──
  drawCircularImage(
    ctx,
    mvpImg,
    BALLOT_LAYOUT.mvpAvatar.x,
    BALLOT_LAYOUT.mvpAvatar.y,
    mvpRadius,
    '🏆',
    mvpRadius * 0.8,
    0,
    'rgba(0,0,0,0)'
  );

  // ── Nombre de MVP ──
  const mvpNameFontFamily = BALLOT_LAYOUT.mvpName.fontFamily || 'Anton';
  const mvpNameWeight = mvpNameFontFamily.toLowerCase().includes('anton') ? '400' : '800';
  ctx.font = `${mvpNameWeight} ${BALLOT_LAYOUT.mvpName.fontSize || 56}px "${mvpNameFontFamily}", sans-serif`;
  ctx.fillStyle = BALLOT_LAYOUT.mvpName.color || '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mvpLines = wrapText(ctx, mvpName, BALLOT_LAYOUT.mvpName.maxWidth);
  const mvpTextY = BALLOT_LAYOUT.mvpName.y;

  // Mostrar máximo 2 líneas
  const linesToShow = mvpLines.slice(0, 2);
  const mvpFontSize = BALLOT_LAYOUT.mvpName.fontSize || 56;
  for (let i = 0; i < linesToShow.length; i++) {
    const offset = linesToShow.length === 2 ? (i === 0 ? -mvpFontSize * 0.5 : mvpFontSize * 0.5) : 0;
    ctx.fillText(linesToShow[i], BALLOT_LAYOUT.mvpName.x, mvpTextY + offset);
  }

  // ── MODO DEBUG (para calibrar coordenadas visualmente) ──
  if (DEBUG_MODE) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;

    // userAvatar debug (círculo)
    ctx.beginPath();
    ctx.arc(BALLOT_LAYOUT.userAvatar.x, BALLOT_LAYOUT.userAvatar.y, userRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(BALLOT_LAYOUT.userAvatar.x, BALLOT_LAYOUT.userAvatar.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // username debug (caja)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    const uW = BALLOT_LAYOUT.username.maxWidth;
    const uH = BALLOT_LAYOUT.username.fontSize || 60;
    ctx.fillRect(BALLOT_LAYOUT.username.x - uW / 2, BALLOT_LAYOUT.username.y - uH / 2, uW, uH);
    ctx.strokeRect(BALLOT_LAYOUT.username.x - uW / 2, BALLOT_LAYOUT.username.y - uH / 2, uW, uH);
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(BALLOT_LAYOUT.username.x, BALLOT_LAYOUT.username.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // mvpAvatar debug (círculo)
    ctx.beginPath();
    ctx.arc(BALLOT_LAYOUT.mvpAvatar.x, BALLOT_LAYOUT.mvpAvatar.y, mvpRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(BALLOT_LAYOUT.mvpAvatar.x, BALLOT_LAYOUT.mvpAvatar.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // mvpName debug (caja)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    const mnW = BALLOT_LAYOUT.mvpName.maxWidth;
    const mnH = (BALLOT_LAYOUT.mvpName.fontSize || 56) * 2;
    ctx.fillRect(BALLOT_LAYOUT.mvpName.x - mnW / 2, BALLOT_LAYOUT.mvpName.y - mnH / 2, mnW, mnH);
    ctx.strokeRect(BALLOT_LAYOUT.mvpName.x - mnW / 2, BALLOT_LAYOUT.mvpName.y - mnH / 2, mnW, mnH);
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(BALLOT_LAYOUT.mvpName.x, BALLOT_LAYOUT.mvpName.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export default function ShareCard({ votes, robloxProfile, nominees }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [shareError, setShareError] = useState<string | null>(null);

  const mvpCategoryId = 1;
  const mvpNomineeId = votes[mvpCategoryId];
  const mvpNominee = nominees.find((n) => n.id === mvpNomineeId);

  const ballotOwnerName = robloxProfile?.displayName || 'Pollito verificado';
  const ballotOwnerHandle = robloxProfile?.username ? `@${robloxProfile.username}` : null;

  useEffect(() => {
    let active = true;
    async function generatePreview() {
      try {
        setPreviewLoading(true);
        const canvas = await generateStoryCanvas(
          ballotOwnerName,
          ballotOwnerHandle,
          robloxProfile?.avatarUrl || null,
          mvpNominee?.name || 'Tu selección',
          mvpNominee?.profileImageUrl || null
        );
        if (active) {
          setPreviewUrl(canvas.toDataURL('image/png'));
        }
      } catch (err) {
        console.error('Error generating preview:', err);
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    }
    generatePreview();
    return () => {
      active = false;
    };
  }, [ballotOwnerName, ballotOwnerHandle, robloxProfile?.avatarUrl, mvpNominee?.name, mvpNominee?.profileImageUrl]);

  const handleDownloadImage = async () => {
    if (!previewUrl || downloading) return;
    soundManager.playPop();
    setDownloading(true);

    try {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = `pollitos-awards-${ballotOwnerName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading story image:', error);
      setShareError('Hubo un problema al guardar la imagen. ¡Volvé a intentarlo!');
      setTimeout(() => setShareError(null), 4000);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    soundManager.playPop();
    const shareText = `🏆 ¡YO YA VOTÉ EN LOS POLLITOS AWARDS 2026! 🐣\n💛 ${ballotOwnerName}${ballotOwnerHandle ? ` (${ballotOwnerHandle})` : ''} ya dejó su ballot oficial.\n\n👑 Mi MVP elegido es: **${mvpNominee ? mvpNominee.name : 'Mi ballot oficial'}**\n\n✨ Mira mi ballot y vota el tuyo.\n🔗 ${window.location.origin}\n#TeamPollito #PollitosAwards2026 #Roblox`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'The Pollitos Awards 2026',
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch {
        console.log('Web Share skipped, backing up to Clipboard.');
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="w-full md:max-w-sm mx-auto bg-white md:border-4 md:border-black md:rounded-[2rem] overflow-hidden relative p-0 md:p-6 md:brutalist-shadow flex flex-col items-center text-black">

      {/* Previsualización real de la imagen */}
      <div
        onClick={() => {
          if (previewUrl) {
            soundManager.playPop();
            setIsModalOpen(true);
          }
        }}
        className="relative z-10 mt-4 w-[85%] aspect-[1080/1920] rounded-[1.5rem] overflow-hidden shadow-2xl border-2 border-black/5 flex flex-col items-center justify-center bg-white cursor-zoom-in hover:scale-[1.01] active:scale-95 transition-all duration-300"
        title="Hacé click para ver en pantalla completa"
      >
        {previewLoading ? (
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <span className="text-4xl animate-bounce">🐣</span>
            <p className="font-comic text-xs font-black uppercase text-orange-600">Generando preview...</p>
          </div>
        ) : previewUrl ? (
          <NextImage
            src={previewUrl}
            alt="Tu Ballot Oficial"
            width={1080}
            height={1920}
            unoptimized
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        ) : (
          <div className="text-red-500 font-bold p-4 text-center text-xs">
            ⚠️ Error al generar previsualización
          </div>
        )}
      </div>

      {/* Botón Descargar (inmediatamente debajo del preview) */}
      <button
        onClick={handleDownloadImage}
        disabled={downloading}
        className={`w-[85%] py-4 px-6 rounded-2xl font-display text-base flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer active:scale-95 border-4 border-black brutalist-shadow mt-4 ${downloading
          ? 'bg-orange-300 text-black cursor-wait font-bold'
          : 'bg-orange-500 hover:bg-orange-600 text-white font-extrabold border-b-6 hover:border-b-4'
          }`}
      >
        <Download className={`w-5 h-5 ${downloading ? 'animate-spin' : 'animate-bounce'}`} />
        {downloading ? 'GUARDANDO IMAGEN...' : 'DESCARGAR IMAGEN 📸'}
      </button>

      {shareError && (
        <div className="w-[85%] mt-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-2 text-xs font-bold text-red-600 text-center animate-fade-in">
          {shareError}
        </div>
      )}

      {/* Botón Compartir en Discord */}
      <button
        id="share-button"
        onClick={handleShare}
        className={`w-[85%] py-4 px-6 rounded-2xl font-display text-base flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer active:scale-95 border-4 border-black brutalist-shadow mt-3 ${copied
          ? 'bg-emerald-400 text-black font-extrabold'
          : 'bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold border-b-6 hover:border-b-4'
          }`}
      >
        {copied ? (
          <>
            <Check className="w-5 h-5 animate-pulse" />
            ¡COPIADO PARA COMPARTIR!
          </>
        ) : (
          <>
            <Share2 className="w-5 h-5 animate-bounce" />
            COMPARTIR LINK
          </>
        )}
      </button>

      {copied && (
        <span className="font-comic text-xs text-emerald-600 font-bold mt-2 text-center animate-fade-in mb-2">
          ¡Listo! Pégalo en el grupo de chat o en tu historia 💬
        </span>
      )}

      <span className="font-comic text-[10px] text-gray-500 font-bold mt-2.5 text-center leading-snug">
        La imagen se genera en formato vertical 1080x1920, lista para stories. 🐥
      </span>

      {/* Fullscreen Preview Modal */}
      {isModalOpen && previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fade-in cursor-zoom-out"
          onClick={() => setIsModalOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 font-bold transition-all border border-white/20 active:scale-95 text-xs uppercase"
            onClick={() => setIsModalOpen(false)}
          >
            Cerrar ✕
          </button>

          <div className="w-full max-w-[450px] aspect-[1080/1920] rounded-3xl overflow-hidden shadow-2xl relative">
            <NextImage
              src={previewUrl}
              alt="Ballot Fullscreen Preview"
              width={1080}
              height={1920}
              unoptimized
              className="w-full h-full object-contain pointer-events-auto cursor-zoom-out select-none"
            />
          </div>
          <p className="mt-4 font-comic text-xs text-white/60 font-bold uppercase tracking-wider">
            Tocá en cualquier parte para cerrar
          </p>
        </div>
      )}
    </div>
  );
}
