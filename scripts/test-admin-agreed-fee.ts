import assert from "node:assert/strict";
import test from "node:test";
import { displayAgreedFee } from "../lib/sirah/admin-agreed-fee";
import { formatSirahMoney } from "../lib/sirah/catalog";

const order = { amountMinor: 3240000, currency: "PKR", ledgerFeeMinor: null, ledgerFeeCurrency: null };
test("displays the recorded ledger fee, including zero, in its own currency", () => {
  assert.equal(displayAgreedFee({ ...order, ledgerFeeMinor: 1500000, ledgerFeeCurrency: "PKR" }), formatSirahMoney(1500000, "PKR"));
  assert.equal(displayAgreedFee({ ...order, ledgerFeeMinor: 0, ledgerFeeCurrency: "USD" }), formatSirahMoney(0, "USD"));
});
test("falls back only when no ledger fee is set and does not guess missing currency", () => {
  assert.equal(displayAgreedFee(order), formatSirahMoney(order.amountMinor, order.currency));
  assert.equal(displayAgreedFee({ ...order, ledgerFeeMinor: 1500000 }), "Currency not recorded; set the fee again");
});
