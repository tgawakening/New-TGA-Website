// Sample Sīrah classroom content so /seerah/classroom renders: one session,
// two materials and one pinned announcement. Idempotent (fixed ids, upserts),
// so running it twice changes nothing. Placeholder links only: replace the
// Zoom link and materials from /admin/sirah/classroom before real use.
//   npm run sirah:classroom:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  // Next week, 19:00 UTC, so the page shows a countdown rather than a past session.
  const scheduledAt = new Date(Date.now() + 7 * DAY);
  scheduledAt.setUTCHours(19, 0, 0, 0);

  const lesson = await prisma.sirahLesson.upsert({
    where: { id: "seed-sirah-lesson-week-1" },
    update: {},
    create: {
      id: "seed-sirah-lesson-week-1",
      title: "Arabia before the Prophet ﷺ",
      summary:
        "The tribes, trade routes and powers of the peninsula, and why the setting matters for reading the Sīrah.",
      weekNumber: 1,
      scheduledAt,
      zoomJoinUrl: "https://zoom.us/j/0000000000",
      zoomMeetingId: "000 0000 0000",
    },
  });

  const materials = [
    { id: "seed-sirah-material-slides", title: "Week 1 slides", kind: "SLIDES", url: "https://example.com/sirah/week-1-slides.pdf", order: 0 },
    { id: "seed-sirah-material-reading", title: "Pre-reading: the Arabian setting", kind: "READING", url: "https://example.com/sirah/week-1-reading", order: 1 },
  ];
  for (const material of materials)
    await prisma.sirahMaterial.upsert({
      where: { id: material.id },
      update: {},
      create: { ...material, lessonId: lesson.id },
    });

  await prisma.sirahAnnouncement.upsert({
    where: { id: "seed-sirah-announcement-welcome" },
    update: {},
    create: {
      id: "seed-sirah-announcement-welcome",
      title: "Welcome to the classroom",
      body: "Session dates, joining links, slides and recordings will all be posted here. The Join button appears 30 minutes before each session.",
      pinned: true,
    },
  });

  console.log(`Sīrah classroom seed complete (session ${lesson.id}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
