import { NextResponse } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function normalizeEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function getRequiredEnv(name: string): string {
  const rawValue = process.env[name];
  const value = rawValue ? normalizeEnvValue(rawValue) : "";
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        provider: "STRIPE",
        providerCustomerId: { not: null },
        status: { not: SubscriptionStatus.CANCELED },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription?.providerCustomerId) {
      return NextResponse.json(
        { error: "No active Stripe billing profile was found for this account." },
        { status: 404 },
      );
    }

    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    const stripeModule = await import("stripe");
    const Stripe = stripeModule.default;
    const stripe = new Stripe(stripeSecretKey);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: `${appUrl}/dashboard?billing=returned`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open Stripe billing portal." },
      { status: 500 },
    );
  }
}
