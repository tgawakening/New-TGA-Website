import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClassroomOverview } from "@/components/indigo/classroom/classroom-overview";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
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

  return (
    <ClassroomOverview
      base="/seerah/classroom"
      data={data}
      completedIds={completedIds}
      timezone={user.studentProfile?.timezone}
      now={new Date()}
    />
  );
}
