import "server-only";

export type MissionSupportConfig = {
  checkoutAvailable: boolean;
  testMode: boolean;
  allocationNotice: string;
  policyUrl: string | null;
  impactReportUrl: string | null;
  heroImage: string;
  heroImageCaption: string;
};

function validUrl(value: string | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
}

export function getMissionSupportConfig(): MissionSupportConfig {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const testMode = key.startsWith("sk_test_");
  const policyUrl = validUrl(process.env.MISSION_SUPPORT_POLICY_URL);
  const allocationNotice = process.env.MISSION_SUPPORT_ALLOCATION_NOTICE?.trim() ?? "";
  const demo = /xxx|replace|password@|db-host/i;
  const configured = [key, process.env.STRIPE_WEBHOOK_SECRET, process.env.DATABASE_URL, process.env.MISSION_SUPPORT_MANAGEMENT_SECRET, process.env.RESEND_API_KEY, process.env.EMAIL_FROM].every(value => Boolean(value && !demo.test(value))) && (process.env.MISSION_SUPPORT_MANAGEMENT_SECRET?.length ?? 0) >= 32;
  const liveApproved = process.env.MISSION_SUPPORT_LIVE_APPROVED === "true";
  const heroImage = process.env.MISSION_SUPPORT_HERO_IMAGE?.trim();
  const localHero = heroImage?.startsWith("/") && !heroImage.startsWith("//") && !heroImage.includes("..");
  return {
    checkoutAvailable: process.env.MISSION_SUPPORT_PAYMENTS_ENABLED === "true" && configured && Boolean(policyUrl && allocationNotice) && (testMode || (key.startsWith("sk_live_") && liveApproved)),
    testMode,
    allocationNotice,
    policyUrl,
    impactReportUrl: validUrl(process.env.MISSION_SUPPORT_IMPACT_REPORT_URL),
    heroImage: localHero && heroImage ? heroImage : "/Gen-Mumin.jpeg",
    heroImageCaption: localHero ? (process.env.MISSION_SUPPORT_HERO_CAPTION?.trim() || "TGA educational programme") : "TGA programme artwork · illustration, not a classroom photograph",
  };
}
