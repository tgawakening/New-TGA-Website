import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { getSirahStudentAccess } from "@/services/sirah-classroom.service";
import { sirahStudentCohortAccess } from "@/lib/lms/access";
import { lmsContentAvailable } from "@/lib/lms/content";
import { studentInbox, unreadCount } from "@/lib/lms/notifications";
import { INBOX_PATH } from "@/lib/lms/student-phase5";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { classroomClock } from "@/components/indigo/classroom/clock";
import { ClassroomHeader, SectionHead } from "@/components/indigo/classroom/parts";
import s from "@/components/indigo/classroom/classroom.module.css";
import p from "@/components/indigo/classroom/phase5.module.css";
import { markAllNotificationsRead, markNotificationRead, openNotification } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Notifications | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

/** The student's in-app inbox: newest first, unread marked, mark one or all
 * read. Gated like the classroom: signed in and paid + active in a cohort. */
export default async function NotificationsPage() {
  const { user } = await getSirahStudentAccess();
  if (!user) redirect("/login");
  const now = new Date();
  const ready = await lmsContentAvailable();
  const access = ready ? await sirahStudentCohortAccess(user.id, now) : null;
  if (!access?.allowed) redirect("/dashboard");

  const clock = classroomClock((await viewerTimeZone()) ?? user.studentProfile?.timezone);
  const [items, unread] = await Promise.all([studentInbox(user.id), unreadCount(user.id)]);

  return (
    <div className={s.page}>
      <ClassroomHeader home="/seerah/classroom" week={null} percent={null} back={{ href: "/seerah/classroom", label: "Classroom" }} inbox={{ href: INBOX_PATH, unread }} />
      <main className={s.wrap}>
        <section className={s.section} aria-labelledby="inbox-title">
          <div className={p.headRow}>
            <SectionHead id="inbox-title">Notifications</SectionHead>
            {unread ? (
              <form action={markAllNotificationsRead} className={p.markForm}>
                <button type="submit">Mark all as read</button>
              </form>
            ) : null}
          </div>
          <p className={s.sectionLede}>
            {unread ? `${unread} unread.` : "You are all caught up."} New classes, time changes, notices and resources for your cohort appear here, and by email.
          </p>
          {items.length ? (
            <ol className={p.inbox}>
              {items.map((item) => (
                <li key={item.id} className={`${p.item} ${item.readAt ? "" : p.unread}`}>
                  <div>
                    <h2>
                      {item.readAt ? null : <span className={s.srOnly}>Unread: </span>}
                      {item.title}
                    </h2>
                    <p>{item.body}</p>
                    <div className={p.meta}>
                      <time dateTime={item.createdAt.toISOString()}>{clock.shortDate.format(item.createdAt)}</time>
                      {item.link ? (
                        <form action={openNotification}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className={p.btnGhost} style={{ minHeight: 32, padding: "0 12px" }}>
                            Open
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  {item.readAt ? null : (
                    <form action={markNotificationRead} className={p.markForm}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit">Mark read</button>
                    </form>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className={s.emptyLine}>
              No notifications yet. <Link href="/seerah/classroom">Back to the classroom</Link>
            </p>
          )}
        </section>
      </main>
      <footer className={s.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
