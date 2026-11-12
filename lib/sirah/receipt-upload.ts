import { MAX_SIRAH_RECEIPT_BYTES } from "./registration-payment";

export const SIRAH_RECEIPT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const imageExtension = /\.(jpe?g|png|webp)$/i;

/** File pickers may omit MIME metadata. The server always checks real content. */
export function sirahReceiptSelectionError(file: File) {
  const image = imageExtension.test(file.name) || ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const pdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  if (!file.size) return "Choose a non-empty payment receipt.";
  if (!image && !pdf && file.type) return "Choose a JPG, PNG, WebP or PDF. Export HEIC photos as JPG first.";
  if (file.size > (image ? MAX_SOURCE_IMAGE_BYTES : MAX_SIRAH_RECEIPT_BYTES))
    return image ? "Choose an image up to 20 MB, or save a smaller screenshot." : "Choose a PDF or receipt file up to 4 MB.";
  return "";
}

/** Keep the server's 4 MB limit while making phone screenshots practical. */
export async function prepareSirahReceipt(file: File): Promise<File> {
  const problem = sirahReceiptSelectionError(file);
  if (problem) throw new Error(problem);
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error("This image could not be opened. Save the screenshot as JPG or PNG, or upload a PDF."); }
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1 && file.size <= MAX_SIRAH_RECEIPT_BYTES &&
        file.type !== "image/webp" && !/\.webp$/i.test(file.name)) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preparation is unavailable. Save a smaller JPG or PNG and try again.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.65]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_SIRAH_RECEIPT_BYTES)
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "receipt"}.jpg`, { type: "image/jpeg" });
    }
    throw new Error("The image is still too large. Crop to the transaction details or upload a PDF up to 4 MB.");
  } finally { URL.revokeObjectURL(url); }
}
