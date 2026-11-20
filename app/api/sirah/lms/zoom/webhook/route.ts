import { NextResponse } from "next/server";
import { ZoomConfigError, zoomWebhookEnv } from "@/lib/zoom/env";
import {
  asZoomWebhookBody,
  urlValidationResponse,
  verifyZoomSignature,
  ZOOM_SIGNATURE_HEADER,
  ZOOM_TIMESTAMP_HEADER,
} from "@/lib/zoom/webhook";
import { recordZoomWebhookEvent } from "@/lib/zoom/webhook-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

/**
 * Zoom webhook receiver. Verifies the v0 signature over the raw body, answers
 * endpoint.url_validation, stores the event (de-duplicated) and returns 200.
 * No event processing happens here: see lib/zoom/processor.ts.
 *
 * The signature is checked before url_validation is answered: Zoom signs
 * validation requests too, and answering unsigned ones would let anyone ask
 * the endpoint to HMAC text of their choosing.
 */
export async function POST(request: Request) {
  let secret: string;
  try {
    secret = zoomWebhookEnv().ZOOM_WEBHOOK_SECRET_TOKEN;
  } catch (error) {
    if (error instanceof ZoomConfigError) {
      console.error("[zoom-webhook] not configured:", error.missing.join(", "));
      return reply({ error: "Zoom webhook is not configured." }, 503);
    }
    throw error;
  }

  const rawBody = await request.text();
  const check = verifyZoomSignature({
    rawBody,
    signature: request.headers.get(ZOOM_SIGNATURE_HEADER),
    timestamp: request.headers.get(ZOOM_TIMESTAMP_HEADER),
    secret,
  });
  if (!check.ok) return reply({ error: "Invalid signature.", reason: check.reason }, 401);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return reply({ error: "Body must be JSON." }, 400);
  }
  const body = asZoomWebhookBody(parsed);
  if (!body) return reply({ error: "Not a Zoom event." }, 400);

  if (body.event === "endpoint.url_validation") {
    const validation = urlValidationResponse(body.payload?.plainToken, secret);
    return validation ? reply(validation) : reply({ error: "Invalid plainToken." }, 400);
  }

  try {
    const result = await recordZoomWebhookEvent(body);
    return reply({ received: true, duplicate: !result.stored });
  } catch (error) {
    // Non-2xx makes Zoom retry later; the dedupe key keeps that safe.
    console.error("[zoom-webhook] could not store event", body.event, error instanceof Error ? error.message : error);
    return reply({ error: "Could not store event." }, 500);
  }
}
