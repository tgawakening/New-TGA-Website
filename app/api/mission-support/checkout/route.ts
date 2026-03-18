import { NextResponse } from "next/server";
import { missionSupportCheckoutSchema } from "@/lib/validations/mission-support";
import {
  createMissionSupportDonation,
  createMissionSupportPaypalOrder,
  createMissionSupportStripeCheckout,
} from "@/services/mission-support.service";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = missionSupportCheckoutSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid mission support payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const donation = await createMissionSupportDonation(parsed.data);

    if (parsed.data.paymentMethod === "STRIPE") {
      const result = await createMissionSupportStripeCheckout({
        donationId: donation.donationId,
        successUrl: `${appUrl}/support-our-mission?payment=success&provider=stripe`,
        cancelUrl: `${appUrl}/support-our-mission?payment=cancelled`,
      });
      return NextResponse.json({ mode: "STRIPE", donationId: donation.donationId, paymentReference: donation.paymentReference, ...result });
    }

    if (parsed.data.paymentMethod === "PAYPAL") {
      const result = await createMissionSupportPaypalOrder({
        donationId: donation.donationId,
        returnUrl: `${appUrl}/support-our-mission?payment=success&provider=paypal&donationId=${donation.donationId}`,
        cancelUrl: `${appUrl}/support-our-mission?payment=cancelled`,
      });
      return NextResponse.json({ mode: "PAYPAL", donationId: donation.donationId, paymentReference: donation.paymentReference, ...result });
    }

    return NextResponse.json({
      mode: "MANUAL",
      donationId: donation.donationId,
      paymentReference: donation.paymentReference,
      message: "Manual support submission received. It will remain pending until admin verification.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mission support checkout failed." },
      { status: 500 },
    );
  }
}
