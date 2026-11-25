import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_BATCH } from "@/lib/sirah/catalog";
import { SIRAH_DEFAULT_TIMEZONE, utcToZonedLocal } from "@/lib/sirah/classroom";
import { scheduleZoneOptions } from "@/lib/sirah/schedule-zones";
import { timeZoneLongName } from "@/lib/time/viewer-zone";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { JOIN_OPENS_MINUTES_BEFORE } from "@/lib/lms/access";
import { LMS_JOIN_BEFORE_HOST, LMS_MAX_SESSION_MINUTES, LMS_MEETING_SETTINGS, LMS_WAITING_ROOM } from "@/lib/lms/sessions";
import {
  adminSessionsForCohort,
  attendanceForSessions,
  liveBadge,
  listActiveHosts,
  listCohorts,
  lmsSessionsAvailable,
  type JoinCounts,
  type SessionAttendance,
  type SessionView,
} from "@/lib/lms/schedule";
import { ScheduleFields, SelectField } from "@/components/sirah/classroom-pickers";
import { DeleteSessionButton } from "@/components/sirah/delete-session-button";
import { AdminBunnyPreview, RecordingSourceFields } from "@/components/sirah/recording-source-fields";
import { bunnyConfigured, bunnyUploadConfigured } from "@/lib/lms/bunny";
import { CancelSessionButton } from "@/components/sirah/cancel-session-button";
import "@/app/seerah/classroom/tokens.css";
import styles from "@/components/sirah/admin-classroom.module.css";
import { recordingsAvailable, recordingsForSessions, type RecordingAdminView } from "@/lib/lms/recordings";
import { lmsContentAvailable } from "@/lib/lms/content";
import { externalRecordingsForSessions, standaloneRecordings } from "@/lib/lms/external-recordings";
import { RECORDING_MAX_AUTO_ATTEMPTS } from "@/lib/lms/recording-policy";
import { setRevenuePartner, adminBunnyPreview, cancelLiveSession, changeExternalRecordingVisibility, createLiveSession, deleteLiveSession, deleteStandaloneRecordingAction, retryRecordingFile, saveExternalRecording, saveStandaloneRecordingAction, setRecordingPublished, startBunnyUpload, updateExternalRecordingAction, updateLiveSession } from "./actions";

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
  zone,
}: {
  idPrefix: string;
  session?: SessionView;
  hosts?: { id: string; email: string; licensed: boolean }[];
  /** The admin's own zone: the form's default, and the zone an edit is pre-filled in. */
  zone: string;
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
            defaultValue={session ? utcToZonedLocal(session.startsAt, zone) : ""}
          />
          <div className={styles.field}>
            <span id={`${idPrefix}-zone`} className={styles.label}>
              Time zone
            </span>
            <SelectField name="timeZone" labelId={`${idPrefix}-zone`} options={scheduleZoneOptions(zone)} defaultValue={zone} />
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
          The date and time are read in the time zone chosen above, pre-set to yours:{" "}
          <strong>
            {timeZoneLongName(zone)} ({zone})
          </strong>
          . Change it if you are entering a time from another zone.
        </p>
        <p className={styles.help}>
          Stored once, shown to each student in their own time zone. Students can join from {JOIN_OPENS_MINUTES_BEFORE} minutes
          before the start until the end, or as soon as the host starts the meeting. One host cannot run two overlapping sessions.
        </p>
      </fieldset>
    </>
  );
}

const ATTENDANCE_TEXT = { PRESENT: "Present", PARTIAL: "Partial", JOINED: "In the meeting" } as const;
const MATCH_TEXT = { EMAIL: "matched by email", NAME: "matched by name", NONE: "" } as const;

function stretchesText(stretches: { joinedAt: Date; leftAt: Date | null }[]) {
  return stretches.map((s) => `${endTime.format(s.joinedAt)} to ${s.leftAt ? endTime.format(s.leftAt) : "now"}`).join(", ");
}

function zoomStateText(session: SessionView) {
  if (session.zoomStartedAt && session.zoomEndedAt)
    return `Started ${endTime.format(session.zoomStartedAt)}, ended ${endTime.format(session.zoomEndedAt)} (from Zoom)`;
  if (session.zoomStartedAt) return `Started ${endTime.format(session.zoomStartedAt)} (from Zoom); still running`;
  return "Zoom has not reported a start for this meeting yet.";
}

/** Who attended, from Zoom's participant events and its post-meeting report. */
function AttendanceList({ attendance }: { attendance: SessionAttendance | undefined }) {
  if (!attendance || (!attendance.matched.length && !attendance.unmatched.length))
    return <p className={styles.emptyLine}>No attendance recorded yet. It fills in as students join on Zoom.</p>;
  const present = attendance.matched.filter((a) => a.status === "PRESENT").length;
  return (
    <>
      <p className={styles.help}>
        {attendance.matched.length} matched {attendance.matched.length === 1 ? "student" : "students"}
        {attendance.matched.some((a) => a.status !== "JOINED") ? `, ${present} present for at least 75% of the meeting` : ""}.
        Times are London time.
      </p>
      {attendance.matched.length ? (
        <ul className={styles.rows}>
          {attendance.matched.map((a) => (
            <li key={a.userId} className={styles.row}>
              <span className={a.status === "PARTIAL" ? styles.warn : `${styles.status} ${a.status === "PRESENT" ? styles.statusLive : ""}`}>
                {ATTENDANCE_TEXT[a.status]}
              </span>
              <span className={styles.rowMain}>
                <span>
                  {a.name} · {a.joinedMinutes} min
                </span>
                <span className={styles.rowMeta}>
                  {a.email}
                  {MATCH_TEXT[a.matchMethod] ? ` · ${MATCH_TEXT[a.matchMethod]}` : ""} · {stretchesText(a.stretches)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {attendance.unmatched.length ? (
        <>
          <p className={styles.inlineTitle}>Not matched to a student</p>
          <ul className={styles.rows}>
            {attendance.unmatched.map((u, index) => (
              <li key={`${u.email ?? u.label}-${index}`} className={styles.row}>
                <span className={styles.tag}>{u.isHost ? "Host" : "Guest"}</span>
                <span className={styles.rowMain}>
                  <span>
                    {u.label} · {u.minutes} min
                  </span>
                  <span className={styles.rowMeta}>
                    {u.email ? `${u.email} · ` : "No email shared by Zoom · "}
                    {stretchesText(u.stretches)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

const COPY_TEXT = { PENDING: "Waiting to copy", COPYING: "Copying", READY: "Copied", FAILED: "Failed" } as const;
const ASSET_TEXT = { VIDEO: "Video", AUDIO: "Audio", TRANSCRIPT: "Transcript", CHAT: "Chat" } as const;

function sizeText(bytes: number) {
  if (!bytes) return "size unknown";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

/** Recording status per Zoom recording of this session: copy state, files, Retry and Publish. */
function RecordingPanel({ recordings, session }: { recordings: RecordingAdminView[] | undefined; session: SessionView }) {
  if (!recordings?.length)
    return (
      <p className={styles.emptyLine}>
        No recording yet. When Zoom finishes processing a cloud recording of this class, it is copied here automatically.
      </p>
    );
  return (
    <ul className={styles.rows}>
      {recordings.map((recording) => (
        <li key={recording.id} className={styles.row}>
          <span
            className={
              recording.status === "FAILED"
                ? styles.warn
                : `${styles.status} ${recording.status === "READY" && recording.visibility === "PUBLISHED" ? styles.statusLive : ""}`
            }
          >
            {recording.status === "READY" ? (recording.visibility === "PUBLISHED" ? "Published" : "Ready, hidden") : COPY_TEXT[recording.status]}
          </span>
          <span className={styles.rowMain}>
            <span>
              {recording.startedAt ? `Recorded ${listDate.format(recording.startedAt)}` : "Zoom recording"}
              {recording.endedAt ? ` to ${endTime.format(recording.endedAt)}` : ""}
            </span>
            {recording.assets.map((asset) => (
              <span key={asset.id} className={styles.rowMeta}>
                {ASSET_TEXT[asset.kind]} · {sizeText(asset.sizeBytes)} · {COPY_TEXT[asset.status]}
                {asset.status === "FAILED"
                  ? ` (attempt ${asset.attempts}${asset.attempts < RECORDING_MAX_AUTO_ATTEMPTS ? `; retries automatically up to ${RECORDING_MAX_AUTO_ATTEMPTS}` : ""})`
                  : ""}
                {asset.lastError && asset.status !== "READY" ? ` · ${asset.lastError}` : ""}
              </span>
            ))}
            <span className={styles.rowMeta}>
              {recording.visibility === "PUBLISHED"
                ? `Visible to enrolled students${recording.publishedAt ? ` since ${listDate.format(recording.publishedAt)}` : ""}. Stream only.`
                : recording.status === "READY"
                  ? "Hidden from students until you publish it."
                  : "Can be published once the video is copied."}
            </span>
          </span>
          <div className={styles.rowActions}>
            {recording.assets
              .filter((asset) => asset.status === "FAILED")
              .map((asset) => (
                <form key={asset.id} action={retryRecordingFile}>
                  <input type="hidden" name="assetId" value={asset.id} />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="cohortId" value={session.cohortId} />
                  <button type="submit" className={styles.secondarySmall}>
                    Retry {ASSET_TEXT[asset.kind].toLowerCase()}
                  </button>
                </form>
              ))}
            {recording.status === "READY" || recording.visibility === "PUBLISHED" ? (
              <form action={setRecordingPublished}>
                <input type="hidden" name="recordingId" value={recording.id} />
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="cohortId" value={session.cohortId} />
                <input type="hidden" name="publish" value={recording.visibility === "PUBLISHED" ? "0" : "1"} />
                <button type="submit" className={styles.secondarySmall}>
                  {recording.visibility === "PUBLISHED" ? "Unpublish" : "Publish"}
                </button>
              </form>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SessionLedger({
  sessions,
  counts,
  attendance,
  recordings,
  externalRecordings,
  now,
  canStart,
  canDelete,
  editable,
  zone,
  bunny = { ready: false, uploadReady: false },
}: {
  zone: string;
  /** Whether Bunny playback (and direct upload) are configured on this server. */
  bunny?: { ready: boolean; uploadReady: boolean };
  sessions: SessionView[];
  counts: Map<string, JoinCounts>;
  attendance: Map<string, SessionAttendance>;
  /** Phase 4. Absent until the recordings migration is deployed. */
  recordings?: Map<string, RecordingAdminView[]>;
  externalRecordings?: Awaited<ReturnType<typeof externalRecordingsForSessions>>;
  now: Date;
  canStart: boolean;
  canDelete: boolean;
  editable: boolean;
}) {
  return (
    <ol className={styles.ledger}>
      {sessions.map((session) => {
        const anchor = `live-${session.id}`;
        const open = session.phase === "upcoming" || session.phase === "live";
        // The badge follows Zoom (meeting.started / meeting.ended), not the clock.
        const badge = liveBadge(session, now);
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
                  <span
                    className={badge.tone === "warn" ? styles.warn : `${styles.status} ${badge.tone === "live" ? styles.statusLive : ""}`}
                  >
                    {badge.text}
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
                      <span className={styles.tag}>Live state</span>
                      <span className={styles.rowMain}>
                        <span>{badge.text}</span>
                        <span className={styles.rowMeta}>{zoomStateText(session)}</span>
                      </span>
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

                {session.phase !== "upcoming" || attendance.has(session.id) ? (
                  <div className={styles.subsection}>
                    <h4 className={styles.subTitle}>Attendance</h4>
                    <AttendanceList attendance={attendance.get(session.id)} />
                  </div>
                ) : null}

                {recordings && (session.phase === "past" || recordings.has(session.id)) ? (
                  <div className={styles.subsection}>
                    <h4 className={styles.subTitle}>Recording</h4>
                    <RecordingPanel recordings={recordings.get(session.id)} session={session} />
                  </div>
                ) : null}

                {externalRecordings && session.phase === "past" ? (
                  <div className={styles.subsection}>
                    <h4 className={styles.subTitle}>External recordings</h4>
                    {externalRecordings.filter((item) => item.sessionId === session.id).map((item) => (
                      <div key={item.id}>
                        <div className={styles.inlineForm}>
                          <span>{item.title} · {item.bunnyVideoId ? "Bunny (protected)" : "Public link"} · {item.visibility === "PUBLISHED" ? "Published" : "Hidden"}</span>
                          {item.bunnyVideoId
                            ? <AdminBunnyPreview resourceId={item.id} title={item.title} preview={adminBunnyPreview} />
                            : item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">Open recording</a>}
                          <form action={changeExternalRecordingVisibility}>
                            <input type="hidden" name="resourceId" value={item.id} />
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="cohortId" value={session.cohortId} />
                            <input type="hidden" name="publish" value={item.visibility === "PUBLISHED" ? "0" : "1"} />
                            <button className={styles.secondarySmall} type="submit">{item.visibility === "PUBLISHED" ? "Unpublish" : "Publish"}</button>
                          </form>
                        </div>
                        <details>
                          <summary>Edit recording</summary>
                          <form action={updateExternalRecordingAction} className={styles.inlineForm}>
                            <input type="hidden" name="resourceId" value={item.id} />
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="cohortId" value={session.cohortId} />
                            <label className={styles.label}>Recording label <input className={styles.input} name="title" defaultValue={item.title} maxLength={191} required /></label>
                            <RecordingSourceFields bunnyReady={bunny.ready} uploadReady={bunny.uploadReady} startUpload={startBunnyUpload} defaultSource={item.bunnyVideoId ? "bunny" : "link"} defaultUrl={item.url ?? ""} defaultVideoId={item.bunnyVideoId ?? ""} />
                            <button className={styles.secondarySmall} type="submit">Save changes</button>
                          </form>
                        </details>
                      </div>
                    ))}
                    <form action={saveExternalRecording} className={styles.inlineForm}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="cohortId" value={session.cohortId} />
                      <label className={styles.label}>Recording label <input className={styles.input} name="title" maxLength={191} required /></label>
                      <RecordingSourceFields bunnyReady={bunny.ready} uploadReady={bunny.uploadReady} startUpload={startBunnyUpload} defaultSource={bunny.ready ? "bunny" : "link"} />
                      <label className={styles.check}><input className={styles.checkbox} type="checkbox" name="publish" /> Publish to enrolled students</label>
                      <button className={styles.secondarySmall} type="submit">Save external recording</button>
                    </form>
                  </div>
                ) : null}

                {canDelete && <div className={styles.formFoot}><DeleteSessionButton action={deleteLiveSession} id={session.id} cohort={session.cohortId} title={session.title} className={styles.ghostDanger} /></div>}

                {editable && open ? (
                  <>
                    <form action={updateLiveSession} className={styles.form}>
                      <input type="hidden" name="id" value={session.id} />
                      <input type="hidden" name="cohortId" value={session.cohortId} />
                      <SessionFields idPrefix={anchor} session={session} zone={zone} />
                      <div className={styles.formFoot}>
                        <button type="submit" className={styles.primary}>
                          Save changes
                        </button>
                      </div>
                    </form>
                    {canDelete && <div className={styles.formFoot}>
                      <CancelSessionButton
                        action={cancelLiveSession}
                        sessionId={session.id}
                        cohortId={session.cohortId}
                        title={session.title}
                        when={listDate.format(session.startsAt)}
                        className={styles.ghostDanger}
                      />
                    </div>}
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
  const { cohort: requested, notice, error } = await searchParams;
  const zone = (await viewerTimeZone()) ?? SIRAH_DEFAULT_TIMEZONE;
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
  // Community Leads can schedule, but do not receive attendance/student data
  // or controls for existing sessions and recordings.
  if (access.role === "COMMUNITY_LEAD") return (
    <section data-theme="sirah-classroom" className={themed}>
      <header className={styles.intro}><div><h2 className={styles.title}>Live sessions</h2><p className={styles.lede}>Schedule a new session for a cohort.</p></div></header>
      {notice && <p className={styles.flash} role="status">{notice}</p>}
      {error && <p className={styles.flashError} role="alert">{error}</p>}
      {cohorts.length > 1 && <form method="get" className={styles.inlineForm} aria-label="Choose a cohort"><label className={styles.label}>Cohort <select name="cohort" defaultValue={cohortId ?? ""}>{cohorts.map(c => <option key={c.batchCode} value={c.batchCode}>{c.batchCode}</option>)}</select></label><button className={styles.secondary}>Show</button></form>}
      {cohortId ? <section className={styles.card} id="new-session"><div className={styles.cardHead}><h3 className={styles.cardTitle}>New session</h3><p className={styles.cardLede}>Creates a scheduled Zoom meeting under the chosen host.</p></div>
        {hosts.length === 0 ? <p className={styles.emptyLine}>Register a Zoom host first.</p> : <form action={createLiveSession} className={styles.form}><input type="hidden" name="cohortId" value={cohortId} /><p className={styles.help}>Cohort: {cohortId}</p><SessionFields idPrefix="new-session" hosts={hosts} zone={zone} /><label className={styles.check}><input className={styles.checkbox} type="checkbox" name="notifyStudents" defaultChecked /> Notify students about this new class</label><div className={styles.formFoot}><button type="submit" className={styles.primary}>Schedule session</button></div></form>}
      </section> : <p className={styles.emptyLine}>No cohort exists yet.</p>}
    </section>
  );
  const revenueHosts = access.role === "SUPER_ADMIN" ? await prisma.zoomHost.findMany({ where: { active: true }, select: { id: true, email: true, revenuePartner: true }, orderBy: { email: "asc" } }) : [];
  const now = new Date();
  const data = cohortId ? await adminSessionsForCohort(cohortId, now) : null;
  const attendance = data ? await attendanceForSessions([...data.upcoming, ...data.past], now) : new Map<string, SessionAttendance>();
  // Phase 4: undefined until the recordings migration is deployed, so the page works either way.
  const recordings =
    data && (await recordingsAvailable()) ? await recordingsForSessions([...data.upcoming, ...data.past].map((s) => s.id)) : undefined;
  const contentAvailable = await lmsContentAvailable();
  const externalRecordings = data && contentAvailable ? await externalRecordingsForSessions(data.past.map((session) => session.id)) : undefined;
  const standalone = contentAvailable ? await standaloneRecordings() : [];
  const bunnyReady = bunnyConfigured();
  const uploadReady = bunnyUploadConfigured();
  // The start route admits the env super admin or the host's own account.
  const canStart = access.role === "SUPER_ADMIN";
  const nextUp = data?.upcoming.find((s) => s.phase !== "cancelled");

  return (
    <section data-theme="sirah-classroom" className={themed}>
      {access.role === "SUPER_ADMIN" && <p><Link href="/seerah/classroom/teaching/revenue" className={styles.secondary}>View course revenue</Link></p>}
      {access.role === "SUPER_ADMIN" && <section id="revenue-partners" className={styles.card}><h3 className={styles.cardTitle}>Revenue partners</h3><p className={styles.cardLede}>Manage partner designation. Revenue totals are restricted to the super admin.</p>{revenueHosts.map(host => <form key={host.id} action={setRevenuePartner} className={styles.inlineForm}><input type="hidden" name="hostId" value={host.id} /><input type="hidden" name="enabled" value={host.revenuePartner ? "0" : "1"} /><span>{host.email} - {host.revenuePartner ? "Access granted" : "No revenue access"}</span> <button type="submit" className={styles.secondarySmall}>{host.revenuePartner ? "Revoke access" : "Grant access"}</button></form>)}</section>}
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
          {contentAvailable && <a href="#manual-recordings" className={styles.secondary}>Add a recording</a>}
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
              <p className={styles.cardLede}>Soonest first. Times are London time. Open one for details and available actions.</p>
            </div>
            {data.upcoming.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Nothing scheduled</p>
                <p>Sessions you schedule appear here and in every enrolled student&rsquo;s classroom.</p>
              </div>
            ) : (
              <SessionLedger
                sessions={data.upcoming}
                counts={data.counts}
                attendance={attendance}
                recordings={recordings}
                externalRecordings={externalRecordings}
                zone={zone}
                now={now}
                canStart={canStart}
                canDelete={canStart}
                editable
              />
            )}
          </section>

          <section className={styles.card} aria-labelledby="past-title">
            <div className={styles.cardHead}>
              <h3 id="past-title" className={styles.cardTitle}>
                Past
              </h3>
              <p className={styles.cardLede}>
                Latest first, with how many students joined. Open one for its attendance and recording (copy status, Publish).
              </p>
            </div>
            {data.past.length === 0 ? (
              <p className={styles.emptyLine}>No past sessions yet.</p>
            ) : (
              <SessionLedger
                sessions={data.past}
                counts={data.counts}
                attendance={attendance}
                recordings={recordings}
                externalRecordings={externalRecordings}
                bunny={{ ready: bunnyReady, uploadReady }}
                zone={zone}
                now={now}
                canStart={false}
                canDelete={canStart}
                editable={false}
              />
            )}
          </section>
        </>
      ) : null}

      {contentAvailable && (
        <section className={styles.card} id="manual-recordings" aria-labelledby="manual-recordings-title">
          <div className={styles.cardHead}>
            <h3 id="manual-recordings-title" className={styles.cardTitle}>Add a recording</h3>
            <p className={styles.cardLede}>Add a recording without scheduling a Zoom meeting. Published recordings are visible to enrolled students. Use a Bunny video for anything that should stay protected: upload it to the Bunny Stream library, then paste its video ID here.</p>
          </div>
          <form action={saveStandaloneRecordingAction} className={styles.form}>
            <input type="hidden" name="cohortId" value={cohortId ?? ""} />
            <label className={styles.label}>Title<input className={styles.input} name="title" placeholder="Orientation, Class 1…" maxLength={191} required /></label>
            <RecordingSourceFields bunnyReady={bunnyReady} uploadReady={uploadReady} startUpload={startBunnyUpload} defaultSource={bunnyReady ? "bunny" : "link"} />
            <label className={styles.label}>Description (optional)<input className={styles.input} name="description" maxLength={255} /></label>
            <label className={styles.check}><input className={styles.checkbox} type="checkbox" name="publish" /> Publish to enrolled students</label>
            <button className={styles.primary} type="submit">Save recording</button>
          </form>
          {standalone.map((item) => (
            <details key={item.id} className={styles.subsection}>
              <summary>{item.title} · {item.bunnyVideoId ? "Bunny (protected)" : "Public link"} · {item.visibility === "PUBLISHED" ? "Published" : "Hidden"}</summary>
              {item.bunnyVideoId && <AdminBunnyPreview resourceId={item.id} title={item.title} preview={adminBunnyPreview} />}
              <form action={saveStandaloneRecordingAction} className={styles.inlineForm}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="cohortId" value={cohortId ?? ""} />
                <label className={styles.label}>Title<input className={styles.input} name="title" defaultValue={item.title} maxLength={191} required /></label>
                <RecordingSourceFields bunnyReady={bunnyReady} uploadReady={uploadReady} startUpload={startBunnyUpload} defaultSource={item.bunnyVideoId ? "bunny" : "link"} defaultUrl={item.url ?? ""} defaultVideoId={item.bunnyVideoId ?? ""} />
                <label className={styles.label}>Description (optional)<input className={styles.input} name="description" defaultValue={item.originalFilename ?? ""} maxLength={255} /></label>
                <label className={styles.check}><input className={styles.checkbox} type="checkbox" name="publish" defaultChecked={item.visibility === "PUBLISHED"} /> Publish to enrolled students</label>
                <button className={styles.secondarySmall} type="submit">Save changes</button>
              </form>
              {access.role === "SUPER_ADMIN" && <form action={deleteStandaloneRecordingAction} className={styles.inlineForm}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="cohortId" value={cohortId ?? ""} />
                <button className={styles.ghostDanger} type="submit">Delete recording</button>
              </form>}
            </details>
          ))}
        </section>
      )}

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
              <SessionFields idPrefix="new-session" hosts={hosts} zone={zone} />
              <label className={styles.check}>
                <input className={styles.checkbox} type="checkbox" name="notifyStudents" defaultChecked />
                Notify students about this new class
              </label>
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
