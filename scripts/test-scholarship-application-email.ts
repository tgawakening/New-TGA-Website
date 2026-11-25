import test from "node:test";
import assert from "node:assert/strict";
import { renderEmail, type EmailBody } from "../lib/email-layout";
import { renderScholarshipApplicationEmail } from "../lib/sirah/scholarship-application-email";

for (const [subject, paragraphs, action] of [
  ["Application received", ["We received your application.", "Do not submit or pay any amount until your application has been approved."], undefined],
  ["Your application was approved", ["Your application has been approved.", "Your agreed total is GBP 10.00."], { label: "Sign in", href: "https://example.com/forgot-password" }],
  ["Your application decision", ["Thank you for applying."], undefined],
] as const) {
  test(`branded ${subject} email keeps the original plain text and escapes content`, () => {
    const body: EmailBody = { masthead: "The Global Awakening", heading: subject, paragraphs: [...paragraphs, "<unsafe>"], ...(action ? { action } : {}) };
    const result = renderScholarshipApplicationEmail(subject, body);
    assert.equal(result.text, renderEmail(subject, body).text);
    assert.equal(result.subject, subject);
    assert.match(result.html, /logo-email\.png/);
    assert.match(result.html, /&lt;unsafe&gt;/);
    assert.doesNotMatch(result.html, /<unsafe>/);
    if (subject === "Application received") assert.match(result.html, /border-left:4px solid/);
    if (action) assert.ok(result.html.includes(action.href));
  });
}
