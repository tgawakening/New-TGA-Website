import { calendarFeedConfigured, calendarForUser, verifyCalendarToken } from "@/lib/lms/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sirah/lms/calendar/[token].ics
 * No login: the signed token names the student. Only that student's cohort
 * sessions are returned (lib/lms/calendar), never a Zoom link. A bad or
 * foreign token gets 404 and reveals nothing.
 */
const NOT_FOUND = () => new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!calendarFeedConfigured()) return new Response("The calendar feed is not configured.", { status: 503, headers: { "Cache-Control": "no-store" } });
  const { token: raw } = await params;
  if (!raw.endsWith(".ics")) return NOT_FOUND();
  const userId = verifyCalendarToken(raw.slice(0, -4));
  if (!userId) return NOT_FOUND();
  const body = await calendarForUser(userId);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sirah-live-classes.ics"',
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
