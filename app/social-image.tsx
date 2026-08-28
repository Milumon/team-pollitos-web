import { ImageResponse } from "next/og";
import { createElement } from "react";
import fs from "fs";
import path from "path";

export const alt = "Team Pollito, comunidad oficial de Milumon para Roblox y stream";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Cargar la imagen social estática en base64 para evitar renderizados de CSS complejos
const socialBase64 = (() => {
  try {
    const filePath = path.join(process.cwd(), "public/images/social.png");
    return fs.readFileSync(filePath, "base64");
  } catch (error) {
    console.error("Error al cargar la imagen social para Open Graph:", error);
    return "";
  }
})();

export function createSocialImage() {
  const imgSrc = socialBase64 ? `data:image/png;base64,${socialBase64}` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#111111", // Fondo de respaldo
        }}
      >
        {imgSrc && createElement("img", {
            src: imgSrc,
            alt,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
            },
          })}
      </div>
    ),
    {
      ...size,
    }
  );
}
