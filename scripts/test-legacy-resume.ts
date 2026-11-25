import assert from "node:assert/strict";
import test, { before } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();
let getPendingRegistrationForResume: typeof import("../services/payment.service").getPendingRegistrationForResume;
before(async () => { ({ getPendingRegistrationForResume } = await import("../services/payment.service")); });

test("resume reads the owned historical charge without repricing or changing the registration", async () => {
  tables.clear();
  const registration = {
    id: "saved", userId: "owner", status: "PENDING_PAYMENT", paymentReference: "REF-1",
    selectedCountryCode: "GB", selectedCountryName: "United Kingdom", selectedCurrency: "GBP",
    finalAmount: 1700, pricingSnapshot: { selectedPaymentPlanType: "FULL_COURSE" },
    course: { title: "Saved programme" },
    user: { fullName: "Student", email: "student@example.test", phoneCountryCode: "+44", phoneNumber: "1234567890" },
    payment: { provider: "STRIPE", amount: 1700, currency: "GBP", status: "PENDING" },
  };
  table("user").push({ id: "owner", ...registration.user });
  table("registration").push(registration);
  const before = structuredClone(registration);
  const result = await getPendingRegistrationForResume({ registrationId: "saved", userId: "owner" });
  assert.equal(result.courseTitle, "Saved programme");
  assert.equal(result.paymentMethod, "STRIPE");
  assert.equal(result.paymentPlanType, "FULL_COURSE");
  assert.deepEqual(result.charge, { amount: 13600, currency: "GBP" });
  assert.deepEqual(registration, before);
  await assert.rejects(() => getPendingRegistrationForResume({ registrationId: "saved", userId: "other" }), /not found/);
});

test("resume returns the saved manual payment amount and refuses completed payments", async () => {
  tables.clear();
  const registration = {
    id: "manual", userId: "owner", status: "PENDING_PAYMENT", paymentReference: "REF-2",
    selectedCountryCode: "PK", selectedCountryName: "Pakistan", selectedCurrency: "PKR", finalAmount: 4000,
    pricingSnapshot: { selectedPaymentPlanType: "SUBSCRIPTION" }, course: { title: "Saved programme" },
    user: { fullName: "Student", email: "student@example.test", phoneCountryCode: "+92", phoneNumber: "1234567890" },
    payment: { provider: "JAZZCASH", amount: 4000, currency: "PKR", status: "PENDING" },
  };
  table("user").push({ id: "owner", ...registration.user });
  table("registration").push(registration);
  const result = await getPendingRegistrationForResume({ registrationId: "manual", userId: "owner" });
  assert.deepEqual(result.charge, { amount: 4000, currency: "PKR" });
  assert.equal(result.paymentMethod, "JAZZCASH");
  registration.payment.status = "SUCCEEDED";
  await assert.rejects(() => getPendingRegistrationForResume({ registrationId: "manual", userId: "owner" }), /already completed/);
});
