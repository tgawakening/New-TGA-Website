import { formatSirahMoney } from "@/lib/sirah/catalog";
import { outstandingAdvances, SIRAH_TEACHER_SHARE_PERCENT } from "@/lib/lms/teacher-earnings";
import styles from "./admin-classroom.module.css";

type Action = (form: FormData) => Promise<void>;
export type RevenueHost = {
  id: string;
  email: string;
  revenuePartner: boolean | null;
  revenueSharePercent: { toString(): string } | null;
  advances: { id: string; amountMinor: number; currency: string; reason: string; occurredOn: Date; createdBy: string; createdAt: Date }[];
};

const money = (minor: number, currency: string) => {
  try { return formatSirahMoney(minor, currency); } catch { return `${currency} ${minor}`; }
};
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });

/**
 * Super admin only (the Live classes page renders it for that role, and every
 * action re-checks it): revenue-partner access, each teacher's agreed share
 * and their advances ledger with its history.
 */
export function AdminTeacherRevenue({ hosts, schemaReady, today, setPartner, setShare, recordAdvance }: { hosts: RevenueHost[]; schemaReady: boolean; today: string; setPartner: Action; setShare: Action; recordAdvance: Action }) {
  return (
    <section id="revenue-partners" className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Revenue partners, shares and advances</h3>
        <p className={styles.cardLede}>
          A revenue partner sees their own earnings on My earnings. Leave the share empty to use the course default ({SIRAH_TEACHER_SHARE_PERCENT}%). Advances are deducted from the teacher&apos;s share; entries are permanent, so correct a mistake with a further entry.
        </p>
      </div>
      {!schemaReady ? <p className={styles.help}>Shares and advances become available once the teacher-advances database migration is applied. Until then every partner uses the default {SIRAH_TEACHER_SHARE_PERCENT}%.</p> : null}
      {hosts.length ? (
        <ul className={styles.rows}>
          {hosts.map(host => {
            const outstanding = outstandingAdvances(host.advances);
            const share = host.revenueSharePercent == null ? "" : String(Number(host.revenueSharePercent.toString()));
            return (
              <li key={host.id} className={styles.form} style={{ paddingBlock: "var(--space-5)", borderTop: "1px solid var(--color-rule)" }}>
                <div className={styles.inlineForm}>
                  <strong>{host.email}</strong>
                  <span className={`${styles.status} ${host.revenuePartner ? styles.statusLive : ""}`}>{host.revenuePartner ? "Revenue partner" : "No revenue access"}</span>
                  <form action={setPartner}>
                    <input type="hidden" name="hostId" value={host.id} />
                    <input type="hidden" name="enabled" value={host.revenuePartner ? "0" : "1"} />
                    <button type="submit" className={styles.secondarySmall}>{host.revenuePartner ? "Revoke access" : "Grant access"}</button>
                  </form>
                </div>

                {schemaReady ? <>
                <form action={setShare} className={styles.inlineForm} aria-label={`Share for ${host.email}`}>
                  <input type="hidden" name="hostId" value={host.id} />
                  <label className={styles.field}>
                    <span className={styles.label}>Agreed share (%)</span>
                    <input className={styles.input} name="share" type="number" min="0" max="100" step="0.01" defaultValue={share} placeholder={`${SIRAH_TEACHER_SHARE_PERCENT} (default)`} />
                  </label>
                  <button type="submit" className={styles.secondarySmall}>Save share</button>
                  <span className={styles.help}>{share ? `Currently ${share}%.` : `Using the default ${SIRAH_TEACHER_SHARE_PERCENT}%.`}</span>
                </form>

                <p className={styles.help}>
                  Outstanding advances: {outstanding.length ? outstanding.map(item => money(item.amountMinor, item.currency)).join(", ") : "none"}
                </p>

                <form action={recordAdvance} className={styles.form} aria-label={`Advance for ${host.email}`}>
                  <input type="hidden" name="hostId" value={host.id} />
                  <div className={styles.grid}>
                    <label className={styles.field}>
                      <span className={styles.label}>Entry</span>
                      <select className={styles.input} name="kind" defaultValue="ADVANCE">
                        <option value="ADVANCE">Record an advance</option>
                        <option value="REDUCTION">Reduce an advance</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Amount</span>
                      <input className={styles.input} name="amount" type="number" min="0" step="any" required placeholder="300" />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Currency</span>
                      <input className={styles.input} name="currency" required maxLength={3} defaultValue="GBP" pattern="[A-Za-z]{3}" />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Date</span>
                      <input className={styles.input} name="date" type="date" required max={today} defaultValue={today} />
                    </label>
                    <label className={`${styles.field} ${styles.span2}`}>
                      <span className={styles.label}>Reason</span>
                      <input className={styles.input} name="reason" required maxLength={500} placeholder="e.g. Advance against Sīrah teaching" />
                    </label>
                  </div>
                  <div className={styles.formFoot}>
                    <button type="submit" className={styles.primary}>Save entry</button>
                  </div>
                </form>

                {host.advances.length ? (
                  <details>
                    <summary>Advance history ({host.advances.length})</summary>
                    <ul className={styles.rows}>
                      {host.advances.map(entry => (
                        <li key={entry.id} className={styles.row}>
                          <span className={`${styles.status} ${entry.amountMinor < 0 ? styles.statusLive : ""}`}>{entry.amountMinor > 0 ? "Advance" : "Reduced"}</span>
                          <span className={styles.rowMain}>
                            <strong>{entry.amountMinor > 0 ? "−" : "+"} {money(Math.abs(entry.amountMinor), entry.currency)} · {entry.reason}</strong>
                            <span className={styles.rowMeta}>{day.format(entry.occurredOn)} · recorded by {entry.createdBy}, {stamp.format(entry.createdAt)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className={styles.help}>No advances recorded.</p>
                )}
                </> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyLine}>No active Zoom host is registered.</p>
      )}
    </section>
  );
}
