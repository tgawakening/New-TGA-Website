import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { formattedAmounts, outstandingNow } from "../components/sirah/course-revenue-display";
import { courseRevenueWorkbook } from "../components/sirah/course-revenue-workbook";

test("outstanding combines existing groups by currency and hides zero amounts", () => {
  const combined = outstandingNow([{ currency: "PKR", amountMinor: 15000 }, { currency: "GBP", amountMinor: 0 }], [{ currency: "PKR", amountMinor: 5000 }, { currency: "USD", amountMinor: 100 }]);
  assert.deepEqual(combined, [{ currency: "GBP", amountMinor: 0 }, { currency: "PKR", amountMinor: 20000 }, { currency: "USD", amountMinor: 100 }]);
  const display = formattedAmounts(combined);
  assert.equal(display.length, 2);
  assert.match(display[0], /PKR/);
  assert.match(display[1], /USD/);
});

test("Excel export is a real one-sheet workbook with course and totals values", async () => {
  const workbook = courseRevenueWorkbook([
    { title: "Course", received: ["PKR 150", "GBP 4"], outstanding: ["PKR 20"], upcoming: [] },
    { title: "Total across programs", received: ["PKR 150", "GBP 4"], outstanding: ["PKR 20"], upcoming: [] },
  ]);
  const bytes = await workbook.xlsx.writeBuffer();
  const reopened = new Workbook();
  await reopened.xlsx.load(bytes);
  assert.equal(reopened.worksheets.length, 1);
  const sheet = reopened.worksheets[0];
  assert.equal(sheet.getCell("B2").value, "PKR 150\nGBP 4");
  assert.equal(sheet.getCell("C2").value, "PKR 20");
  assert.equal(sheet.getCell("D2").value, "—");
  assert.equal(sheet.getCell("A3").value, "Total across programs");
});
