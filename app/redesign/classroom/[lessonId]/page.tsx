import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClassroomLesson } from "@/components/indigo/classroom/classroom-lesson";
import {
  gateFrom,
  getLessonDetail,
  getSirahStudentAccess,
  sirahClassroomAvailable,
} from "@/services/sirah-classroom.service";
import { toggleLessonCompletePreview } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Session · preview", robots: { index: false, follow: false } };

/* Same gate and reads as app/seerah/classroom/[lessonId]/page.tsx. */
export default async function LessonPreviewPage({ params }: { params: Promise<{ lessonId: string }> }) {
  // Gate first: nothing about the session is read for someone not enrolled.
  const access = await getSirahStudentAccess();
  if (!access.user) redirect("/login");
  if (!access.allowed) redirect("/dashboard");
  if (!(await sirahClassroomAvailable())) redirect("/redesign/classroom");

  const { lessonId } = await params;
  const now = new Date();
  const detail = await getLessonDetail(lessonId, gateFrom(access), now);
  if (!detail) notFound();

  return (
    <ClassroomLesson
      base="/redesign/classroom"
      detail={detail}
      timezone={access.user.studentProfile?.timezone}
      now={now}
      completeAction={toggleLessonCompletePreview}
    />
  );
}
