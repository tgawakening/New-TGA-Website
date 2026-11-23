import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClassroomOverview } from "@/components/indigo/classroom/classroom-overview";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { lmsSessionsAvailable, studentSchedule } from "@/lib/lms/schedule";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { studentPhase5 } from "@/lib/lms/student-phase5";
import {
  getClassroomData,
  getCompletedLessonIds,
  getSirahStudentAccess,
  sirahClassroomAvailable,
} from "@/services/sirah-classroom.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Classroom | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

export default async function SirahClassroomPage() {
  const { user, allowed } = await getSirahStudentAccess();
  if (!user) redirect("/login");
  if (!allowed) redirect("/dashboard");

  const ready = await sirahClassroomAvailable();
  const [data, completedIds] = ready
    ? await Promise.all([getClassroomData(), getCompletedLessonIds(user.id)])
    : [{ lessons: [], courseMaterials: [], announcements: [] }, new Set<string>()];
  const now = new Date();
  // Live Zoom classes for the student's cohort, by the same paid + active rule.
  const live = (await lmsSessionsAvailable()) ? await studentSchedule(user.id, now) : null;
  // Phase 5: the cohort's published resources and notices, calendar, inbox.
  const phase5 = await studentPhase5(user.id, now);

  return (
    <ClassroomOverview
      base="/seerah/classroom"
      data={data}
      completedIds={completedIds}
      timezone={(await viewerTimeZone()) ?? user.studentProfile?.timezone}
      now={now}
      live={live?.allowed ? live : null}
      phase5={phase5}
    />
  );
}
