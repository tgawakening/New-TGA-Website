/**
 * Dashboard "My LMS" card: shows the signed-in student's own Sīrah cohort
 * content, never placeholder course content. Rendered to HTML. Run with:
 *   node --experimental-test-module-mocks --import tsx --test scripts/test-dashboard-lms-card.ts
 *
 * Mocks only: Next.js navigation and fonts are stubbed; no database, cookie
 * or request is touched.
 */
import assert from "node:assert/strict";
import test, { before, mock } from "node:test";

// CSS modules map each class to its own name; plain stylesheets are empty.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as { _extensions: Record<string, (m: { exports: unknown }, filename: string) => void> };
Module._extensions[".css"] = (m, filename) => {
  m.exports = filename.endsWith(".module.css") ? new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) }) : {};
};

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const font = () => ({ className: "font", variable: "font", style: {} });
mock.module("next/font/google", { namedExports: { Fraunces: font, Sora: font, Inter: font, Amiri: font, Cormorant_Garamond: font, Noto_Naskh_Arabic: font } });
mock.module("next/font/local", { defaultExport: font });
mock.module("next/navigation", {
  namedExports: {
    useRouter: () => router,
    usePathname: () => "/dashboard",
    useSearchParams: () => new URLSearchParams(),
    redirect: () => {},
  },
});

let React: typeof import("react");
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let StudentDashboard: typeof import("../components/dashboard/student-dashboard").default;
before(async () => {
  React = await import("react");
  // The card is on the "Course" tab, which the browser opens from the #course
  // hash after hydration. Server rendering has no hash, so start on that tab.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reactModule = require("react") as { useState: (initial: unknown) => unknown };
  const realUseState = reactModule.useState;
  reactModule.useState = (initial: unknown) => realUseState(initial === "overview" ? "course" : initial);
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  StudentDashboard = (await import("../components/dashboard/student-dashboard")).default;
});

type Props = Parameters<typeof StudentDashboard>[0];

function sirahStudent(enrolmentStatus: string): Props["user"] {
  return {
    id: "student-1",
    currentSirahOnly: false,
    sirahOrders: [],
    fullName: "Test Student",
    email: "student@example.test",
    phoneCountryCode: "+44",
    phoneNumber: "7000000000",
    canManageStripeBilling: false,
    studentProfile: { countryCode: "GB", countryName: "United Kingdom", timezone: "Europe/London" },
    // Legacy-flow Sīrah enrolment (slug "seerah-course"), as the dashboard page passes it.
    enrollments: [{ status: enrolmentStatus, activatedAt: null, course: { slug: "seerah-course", title: "Prophetic Strategies (Seerah)" } }],
    registrations: [],
    subscriptions: [],
  };
}

function render(props: Props) {
  return renderToStaticMarkup(React.createElement(StudentDashboard, props));
}

const PLACEHOLDERS = [
  "Introduction to Prophetic Strategy",
  "Makkan Period Leadership",
  "Diplomacy and Treaty Building",
  "Weekly Live Reflection Circle",
  "Open Seerah LMS",
];

test("an enrolled Sīrah student sees their own recordings, next live session and the Sīrah classroom link", () => {
  const html = render({
    user: sirahStudent("ACTIVE"),
    serverNow: "2026-11-27T10:00:00.000Z",
    recentRecordings: [
      { title: "Session 3: Law and Power in Madinah", href: "/seerah/classroom/recordings/r3", external: false },
      { title: "Session 2: Leadership Before Hijrah", href: "/seerah/classroom/recordings/r2", external: false },
    ],
    latestRecording: { title: "Session 3: Law and Power in Madinah", href: "/seerah/classroom/recordings/r3", external: false },
    nextLiveClass: {
      title: "Sīrah Live: Movement and Strategy",
      startsAt: "2026-11-30T18:00:00.000Z",
      when: "Sunday 30 November, 6:00 pm",
      zone: "UK time",
      live: false,
      joinable: false,
      joinPath: "/seerah/classroom/join/s4",
    },
  });
  for (const text of PLACEHOLDERS) assert.ok(!html.includes(text), `placeholder shown: ${text}`);
  assert.ok(html.includes("My LMS"));
  assert.ok(html.includes("Sīrah | Beyond Chronology"));
  assert.ok(html.includes("Session 3: Law and Power in Madinah"));
  assert.ok(html.includes("Session 2: Leadership Before Hijrah"));
  assert.ok(html.includes('href="/seerah/classroom/recordings/r2"'));
  assert.ok(html.includes("Sīrah Live: Movement and Strategy"));
  assert.ok(html.includes("Open Sīrah classroom"));
  // The stored legacy course title is not used as the course name.
  assert.ok(!html.includes("Prophetic Strategies"));
});

test("an enrolled Sīrah student with no sessions yet sees an empty state, not sample lessons", () => {
  const html = render({ user: sirahStudent("ACTIVE"), serverNow: "2026-11-27T10:00:00.000Z" });
  for (const text of PLACEHOLDERS) assert.ok(!html.includes(text), `placeholder shown: ${text}`);
  assert.ok(html.includes("appear here once your class schedule is published"));
  assert.ok(html.includes("Open Sīrah classroom"));
});

test("a student whose enrolment is not confirmed sees no lessons and is sent to payment", () => {
  const html = render({ user: sirahStudent("PENDING"), serverNow: "2026-11-27T10:00:00.000Z" });
  for (const text of PLACEHOLDERS) assert.ok(!html.includes(text), `placeholder shown: ${text}`);
  assert.ok(!html.includes("Open Sīrah classroom"));
  assert.ok(html.includes("Complete Payment First"));
});
