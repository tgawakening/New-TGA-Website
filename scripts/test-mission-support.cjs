/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks isolate provider and database dependencies for Node tests. */
// Local integration tests use in-memory persistence and a fake provider. They never charge a card or send email.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const ActualStripe = require('stripe');
const { Prisma } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);

let state;
let emails;
let createdSessions;
const duplicate = () => new Prisma.PrismaClientKnownRequestError('Duplicate event', { code: 'P2002', clientVersion: '6.19.2' });
const matches = (item, where) => Object.entries(where).every(([key, value]) => value && typeof value === 'object' && 'in' in value ? value.in.includes(item[key]) : item[key] === value);
const store = {
  missionSupportDonation: {
    async findUnique({ where, include }) {
      const item = [...state.donations.values()].find(d => matches(d, where));
      if (!item) return null;
      const result = structuredClone(item);
      if (include?.payments) result.payments = [...state.payments.values()].filter(p => p.donationId === item.id && (!include.payments.where || matches(p, include.payments.where)));
      return result;
    },
    async create({ data }) {
      if ([...state.donations.values()].some(d => d.checkoutKey === data.checkoutKey)) throw duplicate();
      const item = { id: 'donation-1', status: 'INITIATED', currency: 'GBP', paidAt: null, providerOrderId: null, providerSubscriptionId: null, providerCustomerId: null, createdAt: new Date(), ...data };
      state.donations.set(item.id, item); return structuredClone(item);
    },
    async update({ where, data }) { const item = state.donations.get(where.id); Object.assign(item, data); return structuredClone(item); },
    async updateMany({ where, data }) { let count = 0; for (const item of state.donations.values()) if (matches(item, where)) { Object.assign(item, data); count++; } return { count }; },
  },
  missionSupportPayment: {
    async findUnique({ where }) { return structuredClone([...state.payments.values()].find(p => matches(p, where)) ?? null); },
    async findFirst({ where }) { return structuredClone([...state.payments.values()].find(p => matches(p, where)) ?? null); },
    async upsert({ where, create, update }) { const item = [...state.payments.values()].find(p => matches(p, where)); if (item) Object.assign(item, update); else { const next = { id: `payment-${state.payments.size + 1}`, refundedAmount: 0, ...create }; state.payments.set(next.id, next); } },
    async update({ where, data }) { const item = state.payments.get(where.id); Object.assign(item, data); return structuredClone(item); },
  },
  missionSupportWebhookEvent: {
    async create({ data }) { if (state.events.has(data.id)) throw duplicate(); state.events.add(data.id); },
    async findUnique({ where }) { return state.events.has(where.id) ? { id: where.id } : null; },
  },
  async $transaction(callback) { const snapshot = structuredClone(state); try { return await callback(store); } catch (error) { state = snapshot; throw error; } },
};
const realStripe = new ActualStripe('sk_test_local_only');
const fakeStripe = {
  webhooks: realStripe.webhooks,
  checkout: { sessions: {
    async create(params, options) { createdSessions.push({ params, options }); return { id: 'cs_test_example', url: 'https://checkout.stripe.com/example', ...params }; },
    async retrieve() { return state.session; },
  } },
  subscriptions: { async retrieve() { return state.subscription; } },
  invoicePayments: { async list() { return { data: [{ status: 'paid', payment: { payment_intent: 'pi_invoice' } }] }; } },
  billingPortal: { sessions: { async create(params) { return { url: 'https://billing.stripe.com/example', ...params }; } } },
  refunds: { async create(params, options) { return { id: 're_test', status: 'pending', ...params, options }; } },
  charges: { async retrieve() { return state.charge; } },
};
class FakeStripe { constructor() { return fakeStripe; } }
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/prisma') return { prisma: store };
  if (request === '@/lib/email') return { sendTransactionalEmail: async data => { emails.push(data); return { status: 'SENT' }; }, notifyAdmins: async () => ({ status: 'SENT' }) };
  if (request === 'server-only') return {};
  if (request === 'stripe') return FakeStripe;
  if (request.startsWith('@/')) request = path.join(root, request.slice(2));
  return originalLoad.call(this, request, parent, isMain);
};
const { missionSupportStripeCheckoutSchema } = require('../lib/validations/mission-support.ts');
const { buildMissionCheckoutParams, paidSessionMatches } = require('../lib/mission-support-checkout.ts');
const { getMissionSupportConfig } = require('../lib/mission-support-config.ts');
const service = require('../services/mission-support-stripe.service.ts');
const baseDonation = { id: 'donation-1', fullName: 'Test Supporter', email: 'test@example.com', amount: 2500, currency: 'GBP', paymentMethod: 'STRIPE', paymentReference: 'TEST-REFERENCE', purpose: 'LEARNING_ACCESS', frequency: 'ONE_TIME', providerOrderId: 'cs_test_example', providerCustomerId: 'cus_test', providerSubscriptionId: null, paidAt: null, status: 'PENDING' };
const input = { fullName: 'Test Supporter', email: 'test@example.com', amountGbp: 25, purpose: 'LEARNING_ACCESS', frequency: 'MONTHLY', requestId: 'b877580d-d85d-44d7-a01f-72266812516b' };
const event = (type, object, id = 'evt_1') => ({ id, type, created: 1760000000, data: { object } });
const session = (extra = {}) => ({ id: 'cs_test_example', metadata: { paymentKind: 'MISSION_SUPPORT', donationId: 'donation-1' }, amount_total: 2500, currency: 'gbp', payment_status: 'paid', payment_intent: 'pi_test', customer: 'cus_test', subscription: null, ...extra });
const invoice = (extra = {}) => ({ id: 'in_test', amount_paid: 2500, amount_due: 2500, currency: 'gbp', status: 'paid', hosted_invoice_url: 'https://invoice.stripe.com/test', customer: 'cus_test', parent: { subscription_details: { subscription: 'sub_test', metadata: { paymentKind: 'MISSION_SUPPORT', donationId: 'donation-1' } } }, ...extra });
beforeEach(() => {
  state = { donations: new Map([['donation-1', structuredClone(baseDonation)]]), payments: new Map(), events: new Set(), session: session(), subscription: { id: 'sub_test', customer: 'cus_test', status: 'canceled', cancel_at_period_end: true }, charge: { amount_refunded: 2500, refunded: true } };
  emails = []; createdSessions = [];
  Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: 'whsec_local_only', MISSION_SUPPORT_MANAGEMENT_SECRET: 'local-unit-test-secret-at-least-32-characters', NEXT_PUBLIC_APP_URL: 'http://localhost:3000', MISSION_SUPPORT_PAYMENTS_ENABLED: 'false', MISSION_SUPPORT_LIVE_APPROVED: 'false' });
});

test('accepts GBP cents and rejects invalid amounts, purpose, frequency and donor details', () => {
  assert.equal(missionSupportStripeCheckoutSchema.safeParse(input).success, true);
  for (const patch of [{ amountGbp: 0 }, { amountGbp: NaN }, { amountGbp: 1.001 }, { amountGbp: 10001 }, { purpose: 'UNAPPROVED' }, { frequency: 'WEEKLY' }, { email: 'invalid' }, { fullName: '' }]) assert.equal(missionSupportStripeCheckoutSchema.safeParse({ ...input, ...patch }).success, false);
});
test('monthly checkout retains purpose in subscription metadata and charges exact GBP pence', () => {
  const params = buildMissionCheckoutParams({ ...baseDonation, frequency: 'MONTHLY' }, 'https://test.example');
  assert.equal(params.mode, 'subscription'); assert.equal(params.line_items[0].price_data.unit_amount, 2500);
  assert.equal(params.line_items[0].price_data.recurring.interval, 'month'); assert.equal(params.subscription_data.metadata.purpose, 'LEARNING_ACCESS');
  assert.match(params.success_url, /session_id=\{CHECKOUT_SESSION_ID\}/);
});
test('new mission funding preferences retain their exact meaning through checkout', () => {
  for (const purpose of ['SEERAH_LEADERSHIP', 'LEARNING_RESOURCES']) {
    assert.equal(missionSupportStripeCheckoutSchema.safeParse({ ...input, purpose }).success, true);
    const params = buildMissionCheckoutParams({ ...baseDonation, purpose, frequency: 'MONTHLY' }, 'https://test.example');
    assert.equal(params.metadata.purpose, purpose);
    assert.equal(params.subscription_data.metadata.purpose, purpose);
    assert.match(params.line_items[0].price_data.product_data.description, purpose === 'SEERAH_LEADERSHIP' ? /Seerah & Leadership/ : /Learning Resources & Delivery/);
  }
});
test('one-time checkout creates payment-intent metadata and a provider receipt invoice', () => {
  const params = buildMissionCheckoutParams(baseDonation, 'https://test.example');
  assert.equal(params.mode, 'payment'); assert.equal(params.invoice_creation.enabled, true); assert.equal(params.payment_intent_data.metadata.purpose, 'LEARNING_ACCESS');
  assert.equal(params.line_items[0].price_data.recurring, undefined);
});
test('checkout retries reuse the original session and reject changed contribution details', async () => {
  state.donations.clear();
  const first = await service.startMissionStripeCheckout(input);
  state.session = { ...session(), status: 'open', url: first.checkoutUrl };
  const second = await service.startMissionStripeCheckout(input);
  assert.deepEqual(second, first);
  assert.equal(state.donations.size, 1);
  assert.equal(createdSessions.length, 1);
  assert.equal(createdSessions[0].options.idempotencyKey, `mission-${input.requestId}`);
  await assert.rejects(service.startMissionStripeCheckout({ ...input, amountGbp: 50 }));
  state.session.status = 'expired';
  await assert.rejects(service.startMissionStripeCheckout(input));
  assert.equal(createdSessions.length, 1);
});
test('unpaid sessions and wrong amount or currency are not considered paid', () => {
  assert.equal(paidSessionMatches(session(), baseDonation), true);
  for (const patch of [{ payment_status: 'unpaid' }, { amount_total: 100 }, { currency: 'usd' }]) assert.equal(paidSessionMatches(session(patch), baseDonation), false);
});
test('checkout availability rejects demo credentials and unapproved live activation', () => {
  assert.equal(getMissionSupportConfig().checkoutAvailable, false);
  Object.assign(process.env, { MISSION_SUPPORT_PAYMENTS_ENABLED: 'true', DATABASE_URL: 'mysql://testuser:testpass@localhost/testdb', RESEND_API_KEY: 're_test_example', EMAIL_FROM: 'test@example.com', MISSION_SUPPORT_POLICY_URL: 'https://test.example/terms', MISSION_SUPPORT_ALLOCATION_NOTICE: 'Test allocation rules' });
  assert.equal(getMissionSupportConfig().checkoutAvailable, true);
  process.env.STRIPE_SECRET_KEY = 'sk_live_local_only'; assert.equal(getMissionSupportConfig().checkoutAvailable, false);
  process.env.MISSION_SUPPORT_LIVE_APPROVED = 'true'; assert.equal(getMissionSupportConfig().checkoutAvailable, true);
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'; assert.equal(getMissionSupportConfig().checkoutAvailable, false);
});
test('signed management links reject tampering and expiration', () => {
  const token = service.createMissionManagementToken('donation-1', 1000);
  assert.equal(service.verifyMissionManagementToken(token, 1001), 'donation-1');
  assert.throws(() => service.verifyMissionManagementToken(token + 'bad', 1001));
  assert.throws(() => service.verifyMissionManagementToken(token, 1000 + 366 * 86400000));
});
test('a return to checkout does not confirm a payment before the webhook', async () => {
  assert.equal((await service.getMissionPaymentConfirmation('cs_test_example')).status, 'pending');
  assert.equal(state.payments.size, 0); assert.equal(emails.length, 0);
});
test('unpaid webhook does not create a successful record or send acknowledgment', async () => {
  await service.handleMissionSupportStripeEvent(event('checkout.session.completed', session({ payment_status: 'unpaid' })), fakeStripe);
  assert.equal(state.payments.size, 0); assert.equal(state.donations.get('donation-1').status, 'PENDING'); assert.equal(emails.length, 0);
});
test('duplicate one-time webhooks create one receipt and one acknowledgment', async () => {
  const paid = event('checkout.session.completed', session());
  await service.handleMissionSupportStripeEvent(paid, fakeStripe);
  await service.handleMissionSupportStripeEvent(paid, fakeStripe);
  await service.handleMissionSupportStripeEvent(event('checkout.session.async_payment_succeeded', session(), 'evt_2'), fakeStripe);
  assert.equal(state.payments.size, 1); assert.equal(emails.length, 1); assert.match(emails[0].text, /Sponsor Learning Access/);
  assert.equal((await service.getMissionPaymentConfirmation('cs_test_example')).status, 'confirmed');
});
test('monthly checkout completion alone does not count income', async () => {
  state.donations.get('donation-1').frequency = 'MONTHLY';
  await service.handleMissionSupportStripeEvent(event('checkout.session.completed', session({ subscription: 'sub_test' })), fakeStripe);
  assert.equal(state.payments.size, 0); assert.equal(emails.length, 0);
});
test('recurring invoice events arriving before checkout still retain purpose and separate each month', async () => {
  state.donations.get('donation-1').frequency = 'MONTHLY';
  await service.handleMissionSupportStripeEvent(event('invoice.paid', invoice()), fakeStripe);
  await service.handleMissionSupportStripeEvent(event('invoice.paid', invoice()), fakeStripe);
  await service.handleMissionSupportStripeEvent(event('invoice.paid', invoice({ id: 'in_month_2' }), 'evt_2'), fakeStripe);
  assert.equal(state.payments.size, 2); assert.equal(emails.length, 2);
  assert.equal(state.donations.get('donation-1').purpose, 'LEARNING_ACCESS'); assert.match(emails[0].text, /Manage or cancel monthly support/);
});
test('failed recurring invoices record failure and later payment can recover the same invoice', async () => {
  state.donations.get('donation-1').frequency = 'MONTHLY';
  await service.handleMissionSupportStripeEvent(event('invoice.payment_failed', invoice({ status: 'open', amount_paid: 0 })), fakeStripe);
  assert.equal([...state.payments.values()][0].status, 'FAILED'); assert.equal(emails.length, 0);
  await service.handleMissionSupportStripeEvent(event('invoice.paid', invoice(), 'evt_2'), fakeStripe);
  assert.equal(state.payments.size, 1); assert.equal([...state.payments.values()][0].status, 'SUCCEEDED'); assert.equal(emails.length, 1);
});
test('delayed failed events cannot overwrite an already paid invoice', async () => {
  state.donations.get('donation-1').frequency = 'MONTHLY';
  await service.handleMissionSupportStripeEvent(event('invoice.paid', invoice()), fakeStripe);
  await service.handleMissionSupportStripeEvent(event('invoice.payment_failed', invoice({ status: 'open' }), 'evt_2'), fakeStripe);
  assert.equal([...state.payments.values()][0].status, 'SUCCEEDED'); assert.equal(state.donations.get('donation-1').status, 'SUCCEEDED');
});
test('subscription events reconcile current provider cancellation state', async () => {
  state.donations.get('donation-1').frequency = 'MONTHLY';
  await service.handleMissionSupportStripeEvent(event('customer.subscription.updated', { id: 'sub_test', status: 'active', metadata: { paymentKind: 'MISSION_SUPPORT', donationId: 'donation-1' } }), fakeStripe);
  assert.equal(state.donations.get('donation-1').subscriptionStatus, 'canceled');
});
test('refunds require confirmed income and change the ledger only after provider confirmation', async () => {
  await service.handleMissionSupportStripeEvent(event('checkout.session.completed', session()), fakeStripe);
  const payment = [...state.payments.values()][0];
  await assert.rejects(() => service.refundMissionPayment(payment.id, 'test-refund', 3000));
  assert.equal((await service.refundMissionPayment(payment.id, 'test-refund')).status, 'pending');
  assert.equal(payment.refundedAmount, 0);
  await service.handleMissionSupportStripeEvent(event('charge.refunded', { id: 'ch_test', payment_intent: 'pi_test' }, 'evt_refund'), fakeStripe);
  assert.equal(state.payments.get(payment.id).status, 'REFUNDED'); assert.equal(state.payments.get(payment.id).refundedAmount, 2500);
});
test('course checkout events are left for the existing course payment handler', async () => {
  assert.equal(await service.handleMissionSupportStripeEvent(event('checkout.session.completed', session({ metadata: { paymentKind: 'COURSE' } })), fakeStripe), false);
  assert.equal(state.payments.size, 0);
});
test('provider webhook signatures reject forged payloads', () => {
  const body = JSON.stringify(event('checkout.session.completed', session()));
  const header = realStripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_local_only' });
  assert.equal(realStripe.webhooks.constructEvent(body, header, 'whsec_local_only').id, 'evt_1');
  assert.throws(() => realStripe.webhooks.constructEvent(body.replace('2500', '5000'), header, 'whsec_local_only'));
});
