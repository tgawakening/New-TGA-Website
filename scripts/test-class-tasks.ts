import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { before, beforeEach, mock } from "node:test";

const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
type Row = { id: string; sessionId: string | null; recordingId: string | null; externalRecordingId: string | null; cohort: string | null; targetVisible: boolean; publishedAt: Date | null; title: string; body: string };
let rows: Row[] = [];
let submissions: { taskId: string; studentId: string; answer: string; link: string | null; submittedAt: Date }[] = [];
let studentWhere = "";
const getCohort = async (id: string) => id === "unpaid" ? { allowed: false, cohortId: null } : { allowed: true, cohortId: id === "other" ? "other" : "batch" };
// The fake applies the Prisma filters provided by the service, including per-student submission selection.
function filter(where: any, row: Row) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (where?.id && where.id !== row.id) return false;
  if (where?.publishedAt && (!row.publishedAt || row.publishedAt > where.publishedAt.lte)) return false;
  if (!where?.OR) return true;
  return where.OR.some((clause: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (clause.session?.is && row.sessionId) return row.cohort === clause.session.is.cohortId;
    if (clause.recording?.is && row.recordingId) return row.targetVisible && row.cohort === clause.recording.is.session.cohortId;
    if (clause.externalRecording?.is && row.externalRecordingId) return row.targetVisible && (row.cohort === null || row.cohort === clause.externalRecording.is.OR[0].session.is.cohortId);
    return false;
  });
}
function select(row: Row, spec: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!spec?.submissions) return { id: row.id };
  studentWhere = spec.submissions.where.studentId;
  const mine = submissions.filter(sub => sub.taskId === row.id && sub.studentId === studentWhere);
  return { ...row, submissions: mine };
}
const fake: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
  lmsTask: {
    findFirst: async (args: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const row = rows.find(item => filter(args.where, item));
      return row ? select(row, args.select) : null;
    },
    findMany: async (args: any) => rows.filter(row => filter(args.where, row)).map(row => select(row, args.select)), // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  lmsTaskSubmission: {
    findFirst: async () => null,
    upsert: async ({ where, create, update }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const match = submissions.find(sub => sub.taskId === where.taskId_studentId.taskId && sub.studentId === where.taskId_studentId.studentId);
      if (match) Object.assign(match, update); else submissions.push({ ...create, submittedAt: new Date() });
    },
  },
  $queryRaw: async () => [],
  $transaction: async (fn: (tx: unknown) => Promise<void>) => fn(fake),
};
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: fake } });
mock.module(file("../lib/lms/access.ts"), { namedExports: { sirahStudentCohortAccess: getCohort } });
let tasks: typeof import("../lib/lms/tasks");
before(async () => { tasks = await import("../lib/lms/tasks"); });
beforeEach(() => {
  rows = [
    { id: "one", sessionId: "session", recordingId: null, externalRecordingId: null, cohort: "batch", targetVisible: true, publishedAt: new Date("2026-01-01"), title: "Question", body: "Instructions" },
    { id: "hidden", sessionId: "session", recordingId: null, externalRecordingId: null, cohort: "batch", targetVisible: true, publishedAt: null, title: "Draft", body: "Draft" },
    { id: "foreign", sessionId: "otherSession", recordingId: null, externalRecordingId: null, cohort: "other", targetVisible: true, publishedAt: new Date("2026-01-01"), title: "Other", body: "Other" },
    { id: "unpublishedRecording", sessionId: null, recordingId: "zoom", externalRecordingId: null, cohort: "batch", targetVisible: false, publishedAt: new Date("2026-01-01"), title: "Private", body: "Private" },
    { id: "standalone", sessionId: null, recordingId: null, externalRecordingId: "external", cohort: null, targetVisible: true, publishedAt: new Date("2026-01-01"), title: "Orientation", body: "Welcome" },
  ];
  submissions = [{ taskId: "one", studentId: "studentB", answer: "Private answer B", link: null, submittedAt: new Date() }];
});

test("students only see published tasks in their cohort and their own submission", async () => {
  const list = await tasks.studentTaskList("studentA");
  assert.deepEqual(list.map(t => t.id), ["one", "standalone"]);
  const detail = await tasks.studentTaskDetail("studentA", "one");
  assert.equal(studentWhere, "studentA");
  assert.deepEqual(detail?.submissions, []);
  assert.equal(await tasks.studentTaskDetail("studentA", "foreign"), null);
  assert.equal(await tasks.studentTaskDetail("studentA", "hidden"), null);
  assert.equal(await tasks.studentTaskDetail("studentA", "unpublishedRecording"), null);
  assert.deepEqual(await tasks.studentTaskList("unpaid"), []);
});
test("submission is scoped to the signed-in student and drafts or other cohorts cannot be submitted", async () => {
  await tasks.submitTask("studentA", "one", "My answer ﷺ", "https://example.com/doc");
  assert.equal(submissions.find(s => s.studentId === "studentA")?.answer, "My answer ﷺ");
  assert.equal(submissions.find(s => s.studentId === "studentB")?.answer, "Private answer B");
  await tasks.submitTask("studentA", "one", "Updated", "");
  assert.equal(submissions.length, 2);
  assert.equal((await tasks.studentTaskDetail("studentA", "one"))?.submissions[0].answer, "Updated");
  for (const id of ["foreign", "hidden", "unpublishedRecording"]) await assert.rejects(() => tasks.submitTask("studentA", id, "answer", ""));
  await assert.rejects(() => tasks.submitTask("unpaid", "one", "answer", ""));
  await assert.rejects(() => tasks.submitTask("studentA", "one", "answer", "javascript:alert(1)"));
  assert.equal(submissions.length, 2);
});
