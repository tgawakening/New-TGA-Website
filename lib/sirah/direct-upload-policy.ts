export const UPLOAD_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export type UploadPurpose = "registration" | "evidence" | "task" | "agreement" | "admin-registration" | "legacy-evidence" | "admin-evidence";
export const UPLOAD_MAX_BYTES: Record<UploadPurpose, number> = { registration: 4 * 1024 * 1024, evidence: 4 * 1024 * 1024, task: 25 * 1024 * 1024, agreement: 5 * 1024 * 1024, "admin-registration": 4 * 1024 * 1024, "legacy-evidence": 4 * 1024 * 1024, "admin-evidence": 5 * 1024 * 1024 };
/** Staff-attached receipts (received by WhatsApp or email): images or PDF only. */
export const ADMIN_EVIDENCE_TYPES = ["image/jpeg", "image/png", "application/pdf"];
/** Audit action marking a receipt that staff attached on the student's behalf. */
export const ADMIN_RECEIPT_UPLOADED = "ADMIN_RECEIPT_UPLOADED";
export function uploadFileType(name: string): string { return UPLOAD_TYPES[name.split(".").pop()?.toLowerCase() || ""] || ""; }
export function uploadFileProblem(purpose: UploadPurpose, name: string, size: number) {
  const type = uploadFileType(name);
  if (!type || ((purpose === "registration" || purpose === "evidence" || purpose === "admin-registration" || purpose === "legacy-evidence") && !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(type)) || (purpose === "agreement" && type !== "application/pdf") || (purpose === "admin-evidence" && !ADMIN_EVIDENCE_TYPES.includes(type))) return "Unsupported format.";
  if (!Number.isSafeInteger(size) || size <= 0) return "Choose a non-empty file.";
  if (size > UPLOAD_MAX_BYTES[purpose]) return `File too large. Maximum ${UPLOAD_MAX_BYTES[purpose] / 1024 / 1024} MB per file.`;
  return "";
}
