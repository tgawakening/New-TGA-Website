import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/* eslint-disable @next/next/no-img-element */

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

async function getLogoDataUrl() {
  const filePath = path.join(process.cwd(), "public", "logo.webp");
  const file = await readFile(filePath);
  return `data:image/webp;base64,${file.toString("base64")}`;
}

export default async function OpenGraphImage() {
  const logoDataUrl = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 72px",
          background: "linear-gradient(135deg, #081526 0%, #14345b 100%)",
          color: "#f7fbff",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            maxWidth: "620px",
          }}
        >
          <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#8fc6ff" }}>
            Global Awakening
          </div>
          <div style={{ fontSize: 64, lineHeight: 1.05 }}>
            Learning rooted in knowledge, character, and purpose.
          </div>
        </div>

        <div
          style={{
            width: 340,
            height: 340,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 32,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.16)",
          }}
        >
          <img src={logoDataUrl} alt="Global Awakening" width="280" height="280" />
        </div>
      </div>
    ),
    size,
  );
}
