import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { sirahOverviewCounts } from "@/services/sirah-group.service";
import styles from "@/components/sirah/admin-overview.module.css";

export const dynamic = "force-dynamic";

const number = (value: number) => value.toLocaleString("en-GB");

export default async function SirahOverviewPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  const counts = await sirahOverviewCounts();
  const groupTotal = counts.groupAdded + counts.groupNotAdded;
  const addedShare = groupTotal ? Math.round((counts.groupAdded / groupTotal) * 100) : 0;
  const tiles = [
    { label: "Total registered", value: counts.total, hint: "All Sīrah registrations", href: "/admin/sirah" },
    { label: "Paid", value: counts.paid, hint: "Verified payment received", href: "/admin/sirah?payment=PAID" },
    { label: "Pending", value: counts.pending, hint: "Registered, payment not yet complete", href: null },
    { label: "Needs attention", value: counts.needsReview, hint: "Receipts to review, checks or failures", href: "/admin/sirah/payments" },
  ];
  return (
    <section className="ga-admin-workspace-card">
      <div className="ga-admin-workspace-head">
        <div>
          <p className="ga-admin-kicker">Current batch</p>
          <h2>Sīrah | Beyond Chronology at a glance</h2>
          <p>Live counts from the enrolment records.</p>
        </div>
      </div>
      <div className={styles.grid}>
        {tiles.map((tile) => {
          const body = (
            <>
              <span className={styles.label}>{tile.label}</span>
              <span className={styles.value}>{number(tile.value)}</span>
              <span className={styles.hint}>{tile.hint}</span>
            </>
          );
          return tile.href ? (
            <a key={tile.label} href={tile.href} className={styles.tile}>
              {body}
            </a>
          ) : (
            <div key={tile.label} className={styles.tile}>
              {body}
            </div>
          );
        })}
      </div>
      <div className={styles.groupCard}>
        <div className={styles.groupHead}>
          <h3>Course group (paid, active students)</h3>
          <a className="ga-admin-outline-btn" href="/admin/sirah?group=NOT_ADDED&payment=PAID">
            Show not yet added
          </a>
        </div>
        <div
          className={styles.meter}
          role="img"
          aria-label={`${counts.groupAdded} of ${groupTotal} paid students added to the course group`}
        >
          <span className={styles.meterAdded} style={{ width: `${addedShare}%` }} />
        </div>
        <div className={styles.legend}>
          <span>
            <i className={styles.dot} aria-hidden="true" /> Added: <strong>{number(counts.groupAdded)}</strong>
          </span>
          <span>
            <i className={`${styles.dot} ${styles.dotMuted}`} aria-hidden="true" /> Not added: <strong>{number(counts.groupNotAdded)}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
