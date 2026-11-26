import { Workbook } from "exceljs";
import type { ExportRow } from "./course-revenue-export";

export function courseRevenueWorkbook(rows: ExportRow[], periodLabel: string, undatedRefunds = 0) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Payments by course");
  sheet.columns = [
    { key: "title", width: 40 },
    { key: "received", width: 30 },
    { key: "net", width: 30 },
    { key: "outstanding", width: 30 },
    { key: "upcoming", width: 38 },
  ];
  sheet.addRow([`Payments by course — ${periodLabel} (Asia/Karachi)`]);
  sheet.addRow(["Program", "Received (verified gross)", "Received net (less verified refunds)", "Outstanding now", "Upcoming (forecast, not guaranteed)"]);
  for (const row of rows) sheet.addRow({ title: row.title, received: row.received.join("\n") || "—", net: row.net.join("\n") || "—", outstanding: row.outstanding.join("\n") || "—", upcoming: row.upcoming.join("\n") || "—" });
  sheet.addRow(["Outstanding and upcoming show current balances, not historical snapshots."]);
  sheet.addRow(["Net uses recorded verified refunds. Legacy refund data may be unavailable; confirm before payouts."]);
  if (undatedRefunds) sheet.addRow([`${undatedRefunds} verified refund(s) have no reliable verification date and are excluded from monthly net.`]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(rows.length + 2).font = { bold: true };
  sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  return workbook;
}
