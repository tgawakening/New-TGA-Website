import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessSirah } from "@/services/sirah-confirmation.service";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { getCurrentUser } from "@/lib/auth/session";

const recordedLessons = [
  "Orientation: How this LMS works",
  "Pre-Islamic Arabia and strategic context",
  "Makkan era resilience and planning",
  "Madinan statecraft and community building",
];

const liveWorkflow = [
  "Weekly live link shared in dashboard and WhatsApp group",
  "Session reminders sent before class",
  "Replay uploaded after the class recording is processed",
];

export default async function SeerahLmsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const enrollment = user.enrollments.find(
    (item) => item.course.slug === "seerah-course",
  );
  const order = (await sirahSchemaAvailable())
    ? await prisma.sirahOrder.findFirst({
        where: { userId: user.id, course: { slug: "seerah-course" } },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (
    (order?.registrationId === enrollment?.registrationId &&
      order &&
      !canAccessSirah(order)) ||
    (enrollment?.status !== "ACTIVE" && !(order && canAccessSirah(order)))
  ) {
    redirect("/dashboard");
  }

  if (order && canAccessSirah(order)) {
    return (
      <main className="ga-page">
        <section className="ga-section">
          <div className="ga-container">
            <h1 className="ga-heading">{SIRAH_TITLE}</h1>
            <p>12 months · Live online teaching and Q&A</p>
            <p>
              Your current-batch enrolment is active. The team will provide the
              confirmed teaching schedule and materials.
            </p>
            <Link
              href={`/seerah/register?order=${order.id}`}
              className="ga-btn ga-btn-primary"
            >
              Your enrolment, billing and course invitation
            </Link>
            <Link href="/dashboard" className="ga-btn ga-btn-outline">
              Student dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }
  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container" style={{ display: "grid", gap: "1rem" }}>
          <div className="ga-dashboard-hero">
            <div>
              <p className="ga-dashboard-kicker">Seerah LMS</p>
              <h1 className="ga-heading">{SIRAH_TITLE}</h1>
              <p
                className="ga-copy"
                style={{ marginTop: "0.75rem", maxWidth: 720 }}
              >
                Your recorded lessons, live class flow, and student community
                access live here.
              </p>
            </div>
            <div className="ga-dashboard-actions">
              <Link href="/dashboard" className="ga-btn ga-btn-outline">
                Back to Dashboard
              </Link>
              <Link
                href={
                  order
                    ? `/seerah/register?order=${order.id}`
                    : "/seerah/register"
                }
                className="ga-btn ga-btn-primary"
                target="_blank"
              >
                Your course registration & invitation
              </Link>
            </div>
          </div>

          <section className="ga-dashboard-split">
            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Recorded Lessons</p>
              <div className="ga-dashboard-list" style={{ marginTop: "1rem" }}>
                {recordedLessons.map((lesson, index) => (
                  <div key={lesson} className="ga-dashboard-list-item">
                    <div>
                      <strong>Lesson {index + 1}</strong>
                      <p>{lesson}</p>
                    </div>
                    <span>Available</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Weekly Live Lessons</p>
              <div className="ga-dashboard-list" style={{ marginTop: "1rem" }}>
                {liveWorkflow.map((item) => (
                  <div key={item} className="ga-dashboard-list-item">
                    <div>
                      <strong>Live Class Update</strong>
                      <p>{item}</p>
                    </div>
                    <span>Active</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
