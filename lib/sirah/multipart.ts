import "server-only";
import { MAX_SIRAH_RECEIPT_BYTES } from "./registration-payment";

/** Bound the stream itself: Content-Length is not trusted for receipt uploads. */
export async function readSirahMultipart(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing upload.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_SIRAH_RECEIPT_BYTES + 65536) {
      await reader.cancel();
      throw new Error("The upload exceeds 4 MB.");
    }
    chunks.push(part.value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
