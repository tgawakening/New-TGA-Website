"use client";

import { useState } from "react";
import styles from "./course-revenue.module.css";

export type ExportRow = { title: string; received: string[]; outstanding: string[]; upcoming: string[] };

export function CourseRevenueExport({ rows, periodKey, periodLabel, undatedRefunds }: { rows: ExportRow[]; periodKey: string; periodLabel: string; undatedRefunds: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    setBusy(true);
    setError(false);
    try {
      const { courseRevenueWorkbook } = await import("./course-revenue-workbook");
      const workbook = courseRevenueWorkbook(rows, periodLabel, undatedRefunds);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payments-by-course-${periodKey === "all" ? "all-time" : periodKey}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.export}><button className={styles.download} type="button" onClick={download} disabled={busy}>{busy ? "Preparing Excel…" : "Download Excel"}</button>{error && <span role="alert">Could not prepare the download. Please try again.</span>}</div>;
}
