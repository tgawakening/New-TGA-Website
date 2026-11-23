import "server-only";
import { calendarLinks } from "./calendar";
import { lmsContentAvailable, studentContent } from "./content";
import { unreadCount } from "./notifications";

export const INBOX_PATH = "/seerah/classroom/notifications";

/** Everything Phase 5 adds to a student's classroom page, or null before the
 * migration is deployed or when the student is not enrolled in a cohort (the
 * page then renders exactly as before). */
export async function studentPhase5(userId: string, now = new Date()) {
  if (!(await lmsContentAvailable())) return null;
  const content = await studentContent(userId, now);
  if (!content.allowed) return null;
  return {
    resources: content.resources,
    announcements: content.announcements,
    calendar: calendarLinks(userId),
    inbox: { href: INBOX_PATH, unread: await unreadCount(userId) },
  };
}
