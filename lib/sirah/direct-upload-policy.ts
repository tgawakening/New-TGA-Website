export const UPLOAD_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export type UploadPurpose = "registration" | "evidence" | "task" | "agreement" | "admin-registration";
export const UPLOAD_MAX_BYTES: Record<UploadPurpose, number> = { registration: 4 * 1024 * 1024, evidence: 4 * 1024 * 1024, task: 25 * 1024 * 1024, agreement: 5 * 1024 * 1024, "admin-registration": 4 * 1024 * 1024 };
export function uploadFileType(name: string): string { return UPLOAD_TYPES[name.split(".").pop()?.toLowerCase() || ""] || ""; }
export function uploadFileProblem(purpose: UploadPurpose, name: string, size: number) {
  const type = uploadFileType(name);
  if (!type || ((purpose === "registration" || purpose === "evidence" || purpose === "admin-registration") && !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(type)) || (purpose === "agreement" && type !== "application/pdf")) return "Unsupported format.";
  if (!Number.isSafeInteger(size) || size <= 0) return "Choose a non-empty file.";
  if (size > UPLOAD_MAX_BYTES[purpose]) return `File too large. Maximum ${UPLOAD_MAX_BYTES[purpose] / 1024 / 1024} MB per file.`;
  return "";
}
