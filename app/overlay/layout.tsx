import React from 'react';

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background: transparent !important;
              background-color: transparent !important;
              overflow: hidden !important;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
