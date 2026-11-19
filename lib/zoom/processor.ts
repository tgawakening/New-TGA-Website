import "server-only";

/**
 * Handles one stored ZoomWebhookEvent, outside the webhook request.
 *
 * Phase 1 stub: nothing is wired to call this yet and it changes no state.
 * Phase 2 will run it from a background job that selects rows with
 * processedAt = null, handles them (meeting.started / meeting.ended /
 * recording.completed / participant events) and sets processedAt or error.
 */
export type ZoomEventOutcome = { handled: boolean; note?: string };

export async function processZoomWebhookEvent(event: { id: string; event: string; payload: unknown }): Promise<ZoomEventOutcome> {
  return { handled: false, note: `No handler for ${event.event} yet.` };
}
