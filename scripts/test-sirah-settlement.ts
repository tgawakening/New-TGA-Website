import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { SETTLEMENT_SOURCE, settlementSessionMatches, settlementSessionState } from "../lib/sirah/settlement-check";

const settlement = { id: "settlement-1", orderId: "order-1", stripeSessionId: "cs_1", amountMinor: 1200, currency: "GBP" };
const session = { id: "cs_1", client_reference_id: "settlement-1", mode: "payment", currency: "gbp", amount_total: 1200, metadata: { sirahSource: SETTLEMENT_SOURCE, settlementId: "settlement-1", orderId: "order-1" } } as unknown as Stripe.Checkout.Session;
test("settlement accepts only the exact standalone checkout", () => {
  assert.equal(settlementSessionMatches(settlement, session), true);
  for (const change of [
    { id: "cs_other" }, { client_reference_id: "other" }, { mode: "subscription" },
    { currency: "usd" }, { amount_total: 1201 }, { metadata: { ...session.metadata, orderId: "other" } },
    { metadata: { ...session.metadata, settlementId: "other" } }, { metadata: { ...session.metadata, sirahSource: "other" } },
  ]) assert.equal(settlementSessionMatches(settlement, { ...session, ...change } as Stripe.Checkout.Session), false);
  assert.equal(settlementSessionMatches({ ...settlement, stripeSessionId: null }, session), false);
});

test("only confirmed payments settle; processing stays locked", () => {
  assert.equal(settlementSessionState({ status: "complete", payment_status: "paid" }), "PAID");
  assert.equal(settlementSessionState({ status: "complete", payment_status: "unpaid" }), "PENDING");
  assert.equal(settlementSessionState({ status: "open", payment_status: "unpaid" }), "PENDING");
  assert.equal(settlementSessionState({ status: "expired", payment_status: "unpaid" }), "EXPIRED");
  assert.equal(settlementSessionState({ status: "expired", payment_status: "paid" }), "PENDING");
});
