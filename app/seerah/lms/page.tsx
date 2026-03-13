import Link from "next/link";
import { redirect } from "next/navigation";
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

  const enrollment = user.enrollments.find((item) => item.course.slug === "seerah-course");
  if (enrollment?.status !== "ACTIVE") {
    redirect("/dashboard");
  }

  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container" style={{ display: "grid", gap: "1rem" }}>
          <div className="ga-dashboard-hero">
            <div>
              <p className="ga-dashboard-kicker">Seerah LMS</p>
              <h1 className="ga-heading">Prophetic Seerah and Planning</h1>
              <p className="ga-copy" style={{ marginTop: "0.75rem", maxWidth: 720 }}>
                Your recorded lessons, live class flow, and student community access live here.
              </p>
            </div>
            <div className="ga-dashboard-actions">
              <Link href="/dashboard" className="ga-btn ga-btn-outline">
                Back to Dashboard
              </Link>
              <Link href="https://chat.whatsapp.com/EXcZmIOG9c8LOSdjK7KMko" className="ga-btn ga-btn-primary" target="_blank">
                Join WhatsApp Group
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
