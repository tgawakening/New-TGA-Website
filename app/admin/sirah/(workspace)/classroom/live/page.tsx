import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_BATCH } from "@/lib/sirah/catalog";
import { SIRAH_DEFAULT_TIMEZONE, utcToZonedLocal } from "@/lib/sirah/classroom";
import { SCHEDULE_TIME_ZONES } from "@/lib/sirah/schedule-zones";
import { JOIN_OPENS_MINUTES_BEFORE } from "@/lib/lms/access";
import { LMS_JOIN_BEFORE_HOST, LMS_MAX_SESSION_MINUTES, LMS_MEETING_SETTINGS, LMS_WAITING_ROOM } from "@/lib/lms/sessions";
import {
  adminSessionsForCohort,
  listActiveHosts,
  listCohorts,
  lmsSessionsAvailable,
  type JoinCounts,
  type SessionView,
} from "@/lib/lms/schedule";
import { ScheduleFields, SelectField } from "@/components/sirah/classroom-pickers";
import { CancelSessionButton } from "@/components/sirah/cancel-session-button";
import "@/app/seerah/classroom/tokens.css";
import styles from "@/components/sirah/admin-classroom.module.css";
import { cancelLiveSession, createLiveSession, updateLiveSession } from "./actions";

export const dynamic = "force-dynamic";

/* Live sessions (LMS Phase 2): Zoom-backed classes per cohort. Shown here:
 * schedule, host, Zoom meeting number and join counts. Never shown: the Zoom
 * join URL or passcode. The read query does not even select them. */

const DURATIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180].map((min) => ({
  value: String(min),
  label: min % 60 === 0 ? `${min / 60} hour${min === 60 ? "" : "s"}` : min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`,
}));

/** What every meeting createSession schedules uses, from the Phase 2a constants. */
const MEETING_SETTINGS_TEXT = [
  `waiting room ${LMS_WAITING_ROOM ? "on" : "off"}`,
  `join before host ${LMS_JOIN_BEFORE_HOST ? "allowed" : "off"}`,
  `${LMS_MEETING_SETTINGS.auto_recording} recording`,
  LMS_MEETING_SETTINGS.mute_upon_entry ? "muted on entry" : "",
  "passcode set",
]
  .filter(Boolean)
  .join(", ");

const PHASE_TEXT: Record<SessionView["phase"], string> = {
  upcoming: "Scheduled",
  live: "Live now",
  past: "Took place",
  cancelled: "Cancelled",
};

const listDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: SIRAH_DEFAULT_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const endTime = new Intl.DateTimeFormat("en-GB", { timeZone: SIRAH_DEFAULT_TIMEZONE, hour: "2-digit", minute: "2-digit" });
const dayNumber = new Intl.DateTimeFormat("en-GB", { timeZone: SIRAH_DEFAULT_TIMEZONE, day: "numeric" });
const monthShort = new Intl.DateTimeFormat("en-GB", { timeZone: SIRAH_DEFAULT_TIMEZONE, month: "short" });

const durationOptions = (current?: number) =>
  current && !DURATIONS.some((d) => d.value === String(current))
    ? [...DURATIONS, { value: String(current), label: `${current} min` }].sort((a, b) => Number(a.value) - Number(b.value))
    : DURATIONS;

function joinsText(counts: JoinCounts | undefined) {
  if (!counts?.joins) return "No joins yet";
  return `${counts.students} ${counts.students === 1 ? "student" : "students"} joined${counts.joins > counts.students ? ` (${counts.joins} joins)` : ""}`;
}

function SessionFields({
  idPrefix,
  session,
  hosts,
}: {
  idPrefix: string;
  session?: SessionView;
  hosts?: { id: string; email: string; licensed: boolean }[];
}) {
  return (
    <>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Session</legend>
        <div className={styles.grid}>
          <label className={`${styles.field} ${hosts ? styles.span2 : styles.span4}`}>
            <span className={styles.label}>Title</span>
            <input className={styles.input} name="title" required maxLength={191} defaultValue={session?.title} />
          </label>
          {hosts ? (
            <div className={`${styles.field} ${styles.span2}`}>
              <span id={`${idPrefix}-host`} className={styles.label}>
                Zoom host
              </span>
              <SelectField
                name="hostId"
                labelId={`${idPrefix}-host`}
                options={hosts.map((h) => ({ value: h.id, label: h.email, hint: h.licensed ? "Licensed" : "Not licensed" }))}
                defaultValue={hosts[0]?.id ?? ""}
              />
            </div>
          ) : null}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Schedule</legend>
        <div className={styles.grid}>
          <ScheduleFields
            name="startsLocal"
            idPrefix={idPrefix}
            defaultValue={session ? utcToZonedLocal(session.startsAt, SIRAH_DEFAULT_TIMEZONE) : ""}
          />
          <div className={styles.field}>
            <span id={`${idPrefix}-zone`} className={styles.label}>
              Time zone
            </span>
            <SelectField name="timeZone" labelId={`${idPrefix}-zone`} options={SCHEDULE_TIME_ZONES} defaultValue={SIRAH_DEFAULT_TIMEZONE} />
          </div>
          <div className={styles.field}>
            <span id={`${idPrefix}-duration`} className={styles.label}>
              Duration
            </span>
            <SelectField
              name="durationMin"
              labelId={`${idPrefix}-duration`}
              options={durationOptions(session?.durationMin)}
              defaultValue={String(session?.durationMin ?? 90)}
            />
          </div>
        </div>
        <p className={styles.help}>
          Stored once, shown to each student in their own time zone. Students can join from {JOIN_OPENS_MINUTES_BEFORE} minutes
          before the start until the end. One host cannot run two overlapping sessions.
        </p>
      </fieldset>
    </>
  );
}

function SessionLedger({
  sessions,
  counts,
  canStart,
  editable,
}: {
  sessions: SessionView[];
  counts: Map<string, JoinCounts>;
  canStart: boolean;
  editable: boolean;
}) {
  return (
    <ol className={styles.ledger}>
      {sessions.map((session) => {
        const anchor = `live-${session.id}`;
        const open = session.phase === "upcoming" || session.phase === "live";
        return (
          <li key={session.id} id={anchor} className={styles.ledgerItem}>
            <details className={styles.session}>
              <summary className={styles.sessionSummary}>
                <span className={styles.week}>
                  <span className={styles.weekLabel}>{monthShort.format(session.startsAt)}</span>
                  <span className={styles.weekNumber}>{dayNumber.format(session.startsAt)}</span>
                </span>
                <span className={styles.sessionMain}>
                  <span className={styles.sessionTitle}>{session.title}</span>
                  <span className={styles.sessionMeta}>
                    {listDate.format(session.startsAt)} to {endTime.format(session.endsAt)} · {session.host.email} ·{" "}
                    {joinsText(counts.get(session.id))}
                  </span>
                </span>
                <span className={styles.sessionState}>
                  <span className={`${styles.status} ${session.phase === "live" ? styles.statusLive : ""}`}>
                    {PHASE_TEXT[session.phase]}
                  </span>
                  {open && !session.zoomMeetingId ? <span className={styles.warn}>No Zoom meeting</span> : null}
                  {open && !session.host.active ? <span className={styles.warn}>Host inactive</span> : null}
                </span>
                <svg className={styles.disclosure} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </summary>

              <div className={styles.sessionBody}>
                <div className={styles.subsection}>
                  <h4 className={styles.subTitle}>Zoom</h4>
                  <ul className={styles.rows}>
                    <li className={styles.row}>
                      <span className={styles.tag}>Meeting</span>
                      <span className={styles.rowMain}>
                        <span>{session.zoomMeetingId ? `Meeting ${session.zoomMeetingId}` : "No Zoom meeting"}</span>
                        <span className={styles.rowMeta}>
                          {session.zoomMeetingId
                            ? `Scheduled with ${MEETING_SETTINGS_TEXT}. The join link and passcode are stored encrypted and never shown here.`
                            : "This session has no Zoom meeting attached."}
                        </span>
                      </span>
                    </li>
                    <li className={styles.row}>
                      <span className={styles.tag}>Host</span>
                      <span className={styles.rowMain}>
                        <span>{session.host.email}</span>
                        <span className={styles.rowMeta}>
                          {session.host.licensed ? "Licensed Zoom user" : "Not a licensed Zoom user"}
                          {session.host.active ? "" : " · inactive"} · signs in with this email to start the class
                        </span>
                      </span>
                      {canStart && open && session.zoomMeetingId ? (
                        <div className={styles.rowActions}>
                          <a href={session.startPath} target="_blank" rel="noopener noreferrer" className={styles.secondarySmall}>
                            Start as host
                          </a>
                        </div>
                      ) : null}
                    </li>
                    <li className={styles.row}>
                      <span className={styles.tag}>Joins</span>
                      <span className={styles.rowMain}>
                        <span>{joinsText(counts.get(session.id))}</span>
                        <span className={styles.rowMeta}>Counted when an enrolled student opens the join link inside the window.</span>
                      </span>
                    </li>
                  </ul>
                </div>

                {editable && open ? (
                  <>
                    <form action={updateLiveSession} className={styles.form}>
                      <input type="hidden" name="id" value={session.id} />
                      <input type="hidden" name="cohortId" value={session.cohortId} />
                      <SessionFields idPrefix={anchor} session={session} />
                      <div className={styles.formFoot}>
                        <button type="submit" className={styles.primary}>
                          Save changes
                        </button>
                      </div>
                    </form>
                    <div className={styles.formFoot}>
                      <CancelSessionButton
                        action={cancelLiveSession}
                        sessionId={session.id}
                        cohortId={session.cohortId}
                        title={session.title}
                        when={listDate.format(session.startsAt)}
                        className={styles.ghostDanger}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

export default async function LiveSessionsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; notice?: string; error?: string }>;
}) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(access.role === "SUPER_ADMIN" || access.role === "MANAGER")) redirect("/admin/sirah");
  const { cohort: requested, notice, error } = await searchParams;
  const themed = `${styles.screen} ${sirahFont.variable}`;

  if (!(await lmsSessionsAvailable())) {
    return (
      <section data-theme="sirah-classroom" className={themed}>
        <header className={styles.intro}>
          <div>
            <h2 className={styles.title}>Live sessions</h2>
            <p className={styles.lede}>The live-session tables are not in this database yet. Deploy the LMS migrations and reload this page.</p>
          </div>
        </header>
      </section>
    );
  }

  const [cohorts, hosts] = await Promise.all([listCohorts(), listActiveHosts()]);
  const cohortId =
    cohorts.find((c) => c.batchCode === requested)?.batchCode ??
    cohorts.find((c) => c.batchCode === SIRAH_BATCH)?.batchCode ??
    cohorts[0]?.batchCode ??
    null;
  const now = new Date();
  const data = cohortId ? await adminSessionsForCohort(cohortId, now) : null;
  // The start route admits the env super admin or the host's own account.
  const canStart = access.role === "SUPER_ADMIN";
  const nextUp = data?.upcoming.find((s) => s.phase !== "cancelled");

  return (
    <section data-theme="sirah-classroom" className={themed}>
      <header className={styles.intro}>
        <div>
          <h2 className={styles.title}>Live sessions</h2>
          <p className={styles.lede}>
            {!cohortId
              ? "No cohort exists yet."
              : data && (data.upcoming.length || data.past.length)
                ? `${data.upcoming.filter((s) => s.phase !== "cancelled").length} upcoming, ${data.past.length} past for ${cohortId}.${
                    nextUp ? ` Next: ${listDate.format(nextUp.startsAt)} (London).` : ""
                  }`
                : `No live sessions for ${cohortId} yet. Schedule the first one below; its Zoom meeting is created for you.`}
          </p>
          {hosts.length === 0 ? (
            <p className={styles.attention}>
              No Zoom host is registered. Register the default host with npm run lms:zoom-host:register before scheduling.
            </p>
          ) : null}
        </div>
        <div className={styles.introActions}>
          <a href="#new-session" className={styles.primary}>
            New session
          </a>
          <a href="/admin/sirah/classroom" className={styles.secondary}>
            Classroom
          </a>
        </div>
      </header>

      {notice && (
        <p className={styles.flash} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.flashError} role="alert">
          {error}
        </p>
      )}

      {cohorts.length > 1 ? (
        <form method="get" className={styles.inlineForm} aria-label="Choose a cohort">
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.span2}`}>
              <span id="cohort-pick" className={styles.label}>
                Cohort
              </span>
              <SelectField
                name="cohort"
                labelId="cohort-pick"
                options={cohorts.map((c) => ({ value: c.batchCode, label: c.batchCode }))}
                defaultValue={cohortId ?? ""}
              />
            </div>
            <div className={`${styles.field} ${styles.alignEnd}`}>
              <button type="submit" className={styles.secondary}>
                Show
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {data ? (
        <>
          <section className={styles.card} aria-labelledby="upcoming-title">
            <div className={styles.cardHead}>
              <h3 id="upcoming-title" className={styles.cardTitle}>
                Upcoming
              </h3>
              <p className={styles.cardLede}>Soonest first. Times are London time. Open one to edit, start or cancel it.</p>
            </div>
            {data.upcoming.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Nothing scheduled</p>
                <p>Sessions you schedule appear here and in every enrolled student&rsquo;s classroom.</p>
              </div>
            ) : (
              <SessionLedger sessions={data.upcoming} counts={data.counts} canStart={canStart} editable />
            )}
          </section>

          <section className={styles.card} aria-labelledby="past-title">
            <div className={styles.cardHead}>
              <h3 id="past-title" className={styles.cardTitle}>
                Past
              </h3>
              <p className={styles.cardLede}>Latest first, with how many students joined. Recordings come in a later phase.</p>
            </div>
            {data.past.length === 0 ? (
              <p className={styles.emptyLine}>No past sessions yet.</p>
            ) : (
              <SessionLedger sessions={data.past} counts={data.counts} canStart={false} editable={false} />
            )}
          </section>
        </>
      ) : null}

      {cohortId ? (
        <section className={styles.card} id="new-session" aria-labelledby="new-session-title">
          <div className={styles.cardHead}>
            <h3 id="new-session-title" className={styles.cardTitle}>
              New session
            </h3>
            <p className={styles.cardLede}>
              Creates a scheduled Zoom meeting under the chosen host ({MEETING_SETTINGS_TEXT}). Up to{" "}
              {LMS_MAX_SESSION_MINUTES / 60} hours.
            </p>
          </div>
          {hosts.length === 0 ? (
            <p className={styles.emptyLine}>Register a Zoom host first.</p>
          ) : (
            <form action={createLiveSession} className={styles.form}>
              <input type="hidden" name="cohortId" value={cohortId} />
              <p className={styles.help}>Cohort: {cohortId}</p>
              <SessionFields idPrefix="new-session" hosts={hosts} />
              <div className={styles.formFoot}>
                <button type="submit" className={styles.primary}>
                  Schedule session
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}
    </section>
  );
}
