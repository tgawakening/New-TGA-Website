import "server-only";
import { after } from "next/server";
import { dispatchLmsNotificationEmails } from "./notifications";

/** Runs a notification fan-out after the response is sent, then a first email
 * pass. It never fails or delays the action that triggered it; the hourly
 * maintenance sweep sends any email this pass does not reach. */
export function notifyLater(work: () => Promise<unknown>, label = "lms") {
  after(async () => {
    try {
      await work();
      await dispatchLmsNotificationEmails({ limit: 100 });
    } catch (error) {
      console.error(`[${label}] notification pass failed`, error instanceof Error ? error.name : "error");
    }
  });
}
