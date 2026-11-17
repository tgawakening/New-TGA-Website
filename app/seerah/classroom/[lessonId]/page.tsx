import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClassroomLesson } from "@/components/indigo/classroom/classroom-lesson";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import {
  gateFrom,
  getLessonDetail,
  getSirahStudentAccess,
  sirahClassroomAvailable,
} from "@/services/sirah-classroom.service";
import { toggleLessonComplete } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Session | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

export default async function SirahLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  // Gate first: nothing about the session is read for someone not enrolled.
  const access = await getSirahStudentAccess();
  if (!access.user) redirect("/login");
  if (!access.allowed) redirect("/dashboard");
  if (!(await sirahClassroomAvailable())) redirect("/seerah/classroom");

  const { lessonId } = await params;
  const now = new Date();
  const detail = await getLessonDetail(lessonId, gateFrom(access), now);
  if (!detail) notFound();

  return (
    <ClassroomLesson
      base="/seerah/classroom"
      detail={detail}
      timezone={access.user.studentProfile?.timezone}
      now={now}
      completeAction={toggleLessonComplete}
    />
  );
}
