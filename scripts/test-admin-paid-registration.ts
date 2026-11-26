/** In-memory only: no database, payment provider, or email calls. */
import test, { before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";
import { sumSirahLedger, type SirahLedgerLine } from "../lib/sirah/payment-totals";
installFakePrisma();
let service: typeof import("../services/sirah-admin-paid-registration.service");
let confirmation: typeof import("../services/sirah-confirmation.service");
before(async () => { service = await import("../services/sirah-admin-paid-registration.service"); confirmation = await import("../services/sirah-confirmation.service"); });
beforeEach(() => tables.clear());
const input = (method: "BANK_TRANSFER" | "JAZZCASH" | "EASYPAISA" | "STRIPE" | "CASH" | "OTHER" = "BANK_TRANSFER") => ({ fullName: "Test Student", email: "student@example.test", phone: "03001234567", country: "PK", cohort: "beyond-chronology-2026", plan: "ANNUAL" as const, amount: "12000", method, paymentDate: "2026-01-20", note: "Verified by staff", scope: randomUUID() });
test("the request schema accepts valid details and rejects invalid dates and methods", () => {
  assert.equal(service.adminPaidRegistrationSchema.safeParse(input()).success, true);
  assert.equal(service.adminPaidRegistrationSchema.safeParse({ ...input(), paymentDate: "2026-02-30" }).success, false);
  assert.equal(service.adminPaidRegistrationSchema.safeParse({ ...input(), method: "UNKNOWN" }).success, false);
});
test("paid registration creates active course access and one matching payment in both ledgers", async () => {
  const result = await service.createAdminPaidRegistration(input(), "admin:test");
  const order = table("sirahOrder")[0];
  assert.equal(order.id, result.id);
  assert.equal(order.paymentState, "PAID");
  assert.equal(order.enrolmentState, "ACTIVE");
  assert.equal(order.paidCount, 1);
  assert.equal(order.amountMinor, 1200000);
  assert.equal(order.ledgerFeeMinor, 1200000);
  assert.equal(order.pricingVersion, "admin-paid-registration-v1");
  assert.equal(table("sirahLedgerPayment").length, 1);
  assert.equal(table("sirahLedgerPayment")[0].amountMinor, 1200000);
  assert.equal(table("sirahLedgerPayment")[0].method, "BANK_TRANSFER");
  assert.equal((table("sirahLedgerPayment")[0].receivedAt as Date).toISOString().slice(0, 10), "2026-01-20");
  assert.equal(table("sirahPaymentEvent").length, 1);
  assert.equal(table("sirahPaymentEvent")[0].amountMinor, 1200000);
  assert.equal((table("sirahPaymentEvent")[0].createdAt as Date).toISOString().slice(0, 10), "2026-01-20");
  assert.equal(table("registration").length, 1);
  assert.equal(table("sirahNotification").length, 0);
  assert.equal(confirmation.canAccessSirah(order as Parameters<typeof confirmation.canAccessSirah>[0]), true);
});
test("duplicate email and cohort is refused without a second order or payment", async () => {
  await service.createAdminPaidRegistration(input(), "admin:test");
  await assert.rejects(() => service.createAdminPaidRegistration(input(), "admin:test"), service.ExistingSirahRegistration);
  assert.equal(table("sirahOrder").length, 1);
  assert.equal(table("sirahLedgerPayment").length, 1);
  assert.equal(table("sirahPaymentEvent").length, 1);
});
test("cash is not mislabelled as a bank or card payment and still grants access", async () => {
  await service.createAdminPaidRegistration(input("CASH"), "admin:test");
  const order = table("sirahOrder")[0];
  assert.equal(order.method, "CASH");
  assert.equal(table("sirahLedgerPayment")[0].method, "CASH");
  assert.equal(table("sirahPaymentEvent")[0].provider, "CASH");
  const totals = sumSirahLedger(table("sirahPaymentEvent") as SirahLedgerLine[], ["FIRST", "RENEWAL"]);
  assert.equal(totals.students, 1);
  assert.equal(totals.currencies[0].receivedMinor, 1200000);
  assert.equal(confirmation.canAccessSirah(order as Parameters<typeof confirmation.canAccessSirah>[0]), true);
  assert.equal(table("registration").length, 0);
});
test("an existing account is reused without changing its password or profile", async () => {
  const existing = { id: "existing-user", fullName: "Existing name", email: "student@example.test", status: "ACTIVE", passwordHash: "existing-hash", phoneCountryCode: "+44", phoneNumber: "123456789" };
  table("user").push(existing);
  const result = await service.createAdminPaidRegistration(input(), "reviewer:test");
  assert.equal(result.newAccount, false);
  assert.equal(table("user").length, 1);
  assert.equal(existing.passwordHash, "existing-hash");
  assert.equal(existing.fullName, "Existing name");
  assert.equal(table("sirahOrder")[0].userId, existing.id);
});
test("each supported payment method records its real provider and active course access", async () => {
  for (const method of ["BANK_TRANSFER", "JAZZCASH", "EASYPAISA", "STRIPE", "CASH", "OTHER"] as const) {
    tables.clear();
    await service.createAdminPaidRegistration({ ...input(method), plan: "MONTHLY" }, "reviewer:test");
    assert.equal(table("sirahOrder")[0].method, method);
    assert.equal(table("sirahLedgerPayment")[0].method, method);
    assert.equal(table("sirahPaymentEvent")[0].provider, method);
    assert.equal(confirmation.canAccessSirah(table("sirahOrder")[0] as Parameters<typeof confirmation.canAccessSirah>[0]), true);
  }
});
