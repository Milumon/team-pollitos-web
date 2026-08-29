import React from 'react';

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.documentElement.style.setProperty('background', 'transparent', 'important');
            document.documentElement.style.setProperty('background-color', 'transparent', 'important');
            if (document.body) {
              document.body.style.setProperty('background', 'transparent', 'important');
              document.body.style.setProperty('background-color', 'transparent', 'important');
            }
          `,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body, #__next, main {
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
