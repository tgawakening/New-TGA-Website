import { getSessionIdentity } from "@/lib/auth/session";
import { hostsForIdentity } from "@/lib/lms/schedule";
import { prisma } from "@/lib/prisma";
import { lmsNotice, lmsRedirect } from "@/lib/lms/http";
import { recordingStorage } from "@/lib/lms/recording-storage";
import { RECORDING_PLAYBACK_URL_SECONDS } from "@/lib/lms/recording-policy";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity(request);
  const hosts = await hostsForIdentity(identity);
  const { id } = await params;
  const recording = hosts.length ? await prisma.recording.findFirst({ where: { id, status: "READY", session: { zoomHostId: { in: hosts.map(host => host.id) } } }, select: { id: true } }) : null;
  if (!recording) return lmsNotice(404, "Recording unavailable", "This recording is not available.");
  const assets = await prisma.recordingAsset.findMany({ where: { recordingId: recording.id, status: "READY", kind: { in: ["VIDEO", "AUDIO"] }, storageKey: { not: null } } });
  const asset = assets.find(item => item.kind === "VIDEO") ?? assets.find(item => item.kind === "AUDIO");
  if (!asset?.storageKey) return lmsNotice(404, "Recording unavailable", "This recording is not available.");
  try { return lmsRedirect(await recordingStorage().presign({ key: asset.storageKey, contentType: asset.kind === "VIDEO" ? "video/mp4" : "audio/mp4", filename: asset.kind === "VIDEO" ? "recording.mp4" : "recording.m4a", expiresIn: RECORDING_PLAYBACK_URL_SECONDS })); }
  catch { return lmsNotice(503, "Recording unavailable", "Please try again later."); }
}
