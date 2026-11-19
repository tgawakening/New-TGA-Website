import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zoomDedupeKey, type ZoomWebhookBody } from "./webhook";

type WebhookEventDb = {
  zoomWebhookEvent: {
    create(args: { data: { dedupeKey: string; event: string; payload: Prisma.InputJsonValue } }): Promise<{ id: string }>;
  };
};

export type RecordResult = { stored: true; id: string; dedupeKey: string } | { stored: false; duplicate: true; dedupeKey: string };

/**
 * Insert one verified delivery. A repeat (same dedupeKey) hits the unique
 * index and is reported as a duplicate instead of an error. This is the only
 * work the webhook request does; processing happens later.
 */
export async function recordZoomWebhookEvent(body: ZoomWebhookBody, db: WebhookEventDb = prisma): Promise<RecordResult> {
  const dedupeKey = zoomDedupeKey(body);
  try {
    const row = await db.zoomWebhookEvent.create({
      data: { dedupeKey, event: body.event.slice(0, 128), payload: body as unknown as Prisma.InputJsonValue },
    });
    return { stored: true, id: row.id, dedupeKey };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return { stored: false, duplicate: true, dedupeKey };
    throw error;
  }
}
