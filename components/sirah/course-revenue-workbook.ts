import { Workbook } from "exceljs";
import type { ExportRow } from "./course-revenue-export";

export function courseRevenueWorkbook(rows: ExportRow[]) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Payments by course");
  sheet.columns = [
    { header: "Program", key: "title", width: 40 },
    { header: "Received (verified gross)", key: "received", width: 30 },
    { header: "Outstanding now", key: "outstanding", width: 30 },
    { header: "Upcoming (forecast, not guaranteed)", key: "upcoming", width: 38 },
  ];
  for (const row of rows) sheet.addRow({ title: row.title, received: row.received.join("\n") || "—", outstanding: row.outstanding.join("\n") || "—", upcoming: row.upcoming.join("\n") || "—" });
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(rows.length + 1).font = { bold: true };
  sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return workbook;
}
