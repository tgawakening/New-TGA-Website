/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node checks mock the database and email provider. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const root = process.cwd();
let entries = [], emails = [], fail = false;
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, f);
const load = Module._load;
Module._load = function (r, p, i) { if (r === '@/lib/prisma')
    return { prisma: { emailLog: { findFirst: async ({ where }) => entries.find(e => e.payload.email === where.payload.equals), create: async ({ data }) => { const e = { id: 'interest-' + (entries.length + 1), ...data }; entries.push(e); return e; }, update: async ({ where, data }) => Object.assign(entries.find(e => e.id === where.id), data) } } }; if (r === '@/lib/email')
    return { sendTransactionalEmail: async (p) => { emails.push(p); if (fail)
            throw Error('fake failure'); return { status: 'SENT' }; } }; if (r.startsWith('@/'))
    r = path.join(root, r.slice(2)); return load.call(this, r, p, i); };
(async () => {
    const { divineBondsSchema } = require(path.join(root, 'lib/validations/divine-bonds.ts'));
    const { POST } = require(path.join(root, 'app/api/divine-bonds/waitlist/route.ts'));
    const payload = { name: 'Test <student>', email: 'test@example.com', countryCode: 'PK', phone: '3001234567', interest: 'Marriage preparation', reason: 'Interested in preparing for marriage.', consent: true, website: '' };
    const req = (data = payload, origin = 'http://localhost:3015') => new Request('http://localhost:3015/api/divine-bonds/waitlist', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await POST(req(payload, 'https://foreign.example'))).status, 403);
    assert.equal(entries.length, 0);
    console.log('PASS: foreign origin rejected before saving');
    assert.equal((await POST(req({ ...payload, consent: false }))).status, 400);
    assert.equal((await POST(req({ ...payload, countryCode: 'ZZ' }))).status, 400);
    assert.equal((await POST(req({ ...payload, phone: '123456789012345' }))).status, 400);
    assert.equal(entries.length, 0);
    console.log('PASS: consent, country and full phone length validated');
    const result = await POST(req());
    assert.equal(result.status, 200);
    assert.equal(entries[0].status, 'NOTIFIED');
    assert.equal(entries[0].payload.phone, '+923001234567');
    assert.equal(emails[0].to, 'Enquiries.awakeningteam@outlook.com');
    assert.match(emails[0].html, /&lt;student&gt;/);
    assert.ok(!emails[0].html.includes('<student>'));
    assert.match(emails[0].text, /Marriage preparation/);
    console.log('PASS: interest saved and escaped complete notification sent to TGA');
    assert.equal((await POST(req())).status, 200);
    assert.equal(entries.length, 1);
    assert.equal(emails.length, 1);
    console.log('PASS: repeated submission does not duplicate same-day enquiry');
    fail = true;
    assert.equal((await POST(req({ ...payload, email: 'second@example.com' }))).status, 200);
    assert.equal(entries[1].status, 'NOTIFICATION_PENDING');
    assert.equal(entries[1].payload.reason, payload.reason);
    console.log('PASS: provider failure retains enquiry for review');
    fail = false;
    assert.equal((await POST(req({ ...payload, email: 'second@example.com' }))).status, 200);
    assert.equal(entries.length, 2);
    assert.equal(entries[1].status, 'NOTIFIED');
    console.log('PASS: pending notification retries without creating another enquiry');
    assert.equal(divineBondsSchema.safeParse({ ...payload, reason: 'x' }).success, false);
    console.log('All isolated checks passed: no live database or emails used.');
})().catch(e => { console.error(e); process.exitCode = 1; });
