import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/* eslint-disable @next/next/no-img-element */

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

async function getLogoDataUrl() {
  const filePath = path.join(process.cwd(), "public", "logo.webp");
  const file = await readFile(filePath);
  return `data:image/webp;base64,${file.toString("base64")}`;
}

export default async function Icon() {
  const logoDataUrl = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #081526 0%, #102846 100%)",
        }}
      >
        <img src={logoDataUrl} alt="Global Awakening" width="420" height="420" />
      </div>
    ),
    size,
  );
}
