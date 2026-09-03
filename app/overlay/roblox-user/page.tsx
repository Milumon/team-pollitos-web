'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function RobloxUserWidget() {
  const searchParams = useSearchParams();
  const title = searchParams?.get('title') || 'MI USUARIO';
  const name = searchParams?.get('name') || 'Milumon';
  const handle = searchParams?.get('handle') || '@MilumonRT';
  const customWidth = parseInt(searchParams?.get('width') || searchParams?.get('size') || '250', 10);
  const widthPx = Number.isNaN(customWidth) || customWidth < 180 ? 250 : customWidth;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '16px',
        margin: 0,
        overflow: 'hidden',
        fontFamily: "'Arial Black', 'Impact', Arial, sans-serif",
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: `${widthPx}px`,
          boxSizing: 'border-box',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
        }}
      >
        {/* Pestaña superior tipo Folder / Carpeta */}
        <div
          style={{
            background: 'linear-gradient(180deg, #d6f26b, #8fc93a)',
            border: '3px solid #1a1a1a',
            borderBottom: 'none',
            borderRadius: '12px 12px 0 0',
            padding: '5px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 0 #5b8720',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 900,
              color: '#1a1a1a',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
        </div>

        {/* Tarjeta principal estilo Cartoon Gaming */}
        <div
          style={{
            background: 'linear-gradient(180deg, #2f6fb0, #1c3f66)',
            border: '3px solid #1a1a1a',
            borderRadius: '0 14px 14px 14px',
            padding: '12px 14px',
            boxShadow: '0 4px 0 #0d1f33',
            marginTop: '-3px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Avatar Headshot con borde y relieve 3D */}
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '3px solid #1a1a1a',
                boxShadow: '0 3px 0 #1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src="/images/roblox-milumon.webp"
                alt={name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-58539D3B0772D6FE4AC244FF99F73CE6-Png-Background/150/150/AvatarHeadshot/Webp/noFilter';
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>

            {/* Nombre + Handle Compacto */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Fila Nombre + Insignia Roblox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div
                  style={{
                    fontSize: '19px',
                    fontWeight: 900,
                    color: '#ffe259',
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow:
                      '-1.5px -1.5px 0 #1a1a1a, 1.5px -1.5px 0 #1a1a1a, -1.5px 1.5px 0 #1a1a1a, 1.5px 1.5px 0 #1a1a1a, 0 3px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  {name}
                </div>

                {/* Insignia Hexagonal Verificada de Roblox */}
                <div
                  title="Verificado en Roblox"
                  style={{
                    width: '16px',
                    height: '16px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ display: 'block', filter: 'drop-shadow(0 1.5px 0 #1a1a1a)' }}
                  >
                    {/* Borde exterior del hexágono */}
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M8 0.5L14.5 4.25V11.75L8 15.5L1.5 11.75V4.25L8 0.5Z"
                      fill="#1a1a1a"
                    />
                    {/* Relleno blanco del hexágono */}
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M8 1.8L13.2 4.8V11.2L8 14.2L2.8 11.2V4.8L8 1.8Z"
                      fill="#ffffff"
                    />
                    {/* Espiral / Símbolo oficial interior */}
                    <path
                      d="M8 4.8C6.23 4.8 4.8 6.23 4.8 8C4.8 9.77 6.23 11.2 8 11.2C9.77 11.2 11.2 9.77 11.2 8C11.2 6.7 10.4 5.6 9.3 5.1"
                      stroke="#1a1a1a"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Handle @MilumonRT compacto estilo badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '2px solid #1a1a1a',
                  borderRadius: '6px',
                  padding: '1px 6px',
                  marginTop: '4px',
                  boxShadow: '0 1.5px 0 #1a1a1a',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 900,
                    color: '#ffffff',
                    letterSpacing: '0.2px',
                  }}
                >
                  {handle}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RobloxUserOverlay() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: '250px',
            padding: '16px',
            background: '#1c3f66',
            borderRadius: '14px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 900,
          }}
        >
          Cargando usuario...
        </div>
      }
    >
      <RobloxUserWidget />
    </Suspense>
  );
}
