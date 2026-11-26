import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { formattedAmounts, formattedNetAmounts, netReceived, outstandingNow } from "../components/sirah/course-revenue-display";
import { courseRevenueWorkbook } from "../components/sirah/course-revenue-workbook";
import { estimateMoney, validRate } from "../components/sirah/course-revenue-calculation";

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
    { title: "Course", received: ["PKR 150", "GBP 4"], net: ["PKR 140"], outstanding: ["PKR 20"], upcoming: [] },
    { title: "Total across programs", received: ["PKR 150", "GBP 4"], net: ["PKR 140"], outstanding: ["PKR 20"], upcoming: [] },
  ], "November 2026", 1);
  const bytes = await workbook.xlsx.writeBuffer();
  const reopened = new Workbook();
  await reopened.xlsx.load(bytes);
  assert.equal(reopened.worksheets.length, 1);
  const sheet = reopened.worksheets[0];
  assert.match(String(sheet.getCell("A1").value), /November 2026/);
  assert.equal(sheet.getCell("B3").value, "PKR 150\nGBP 4");
  assert.equal(sheet.getCell("C3").value, "PKR 140");
  assert.equal(sheet.getCell("D3").value, "PKR 20");
  assert.equal(sheet.getCell("E3").value, "—");
  assert.equal(sheet.getCell("A4").value, "Total across programs");
  assert.match(String(sheet.getCell("A7").value), /no reliable verification date/);
});

test("net can be negative when refunds exceed receipts in a month", () => {
  const net = netReceived([{ currency: "GBP", amountMinor: 100 }], [{ currency: "GBP", amountMinor: 300 }]);
  assert.deepEqual(net, [{ currency: "GBP", amountMinor: -200 }]);
  assert.deepEqual(formattedNetAmounts(net), ["GBP -2.00"]);
});

test("manual estimates use each currency's actual minor-unit scale and identify missing rates", () => {
  const values = [{ currency: "GBP", amountMinor: 1000 }, { currency: "PKR", amountMinor: 20000 }, { currency: "KWD", amountMinor: 1234 }, { currency: "USD", amountMinor: 0 }];
  assert.deepEqual(estimateMoney(values, "GBP", { PKR: "0.01", KWD: "2" }), { total: 14.468, included: true, missing: [] });
  assert.deepEqual(estimateMoney(values, "GBP", { PKR: "" }), { total: 10, included: true, missing: ["PKR", "KWD"] });
  assert.deepEqual(estimateMoney([{ currency: "PKR", amountMinor: 200 }], "GBP", {}), { total: 0, included: false, missing: ["PKR"] });
});

test("manual rates reject blank, invalid, negative, zero and infinite values", () => {
  for (const value of ["", " ", "0", "-1", "NaN", "Infinity", "1e999", "1,5"]) assert.equal(validRate(value), null);
  assert.equal(validRate(" .25 "), .25);
  assert.equal(validRate("12.5"), 12.5);
});
