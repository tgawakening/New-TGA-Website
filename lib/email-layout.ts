/** One plain, on-brand email layout (ivory, charcoal, Georgia heading, one
 * gold action), single column, inline styles only, for every client. Used by
 * the classroom emails and the password reset email. */

export type RenderedEmail = { subject: string; html: string; text: string };

export type EmailBody = {
  /** Small line above the heading, e.g. "The Global Awakening". */
  masthead: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; href: string };
  footnote?: string;
};

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const SANS = "Arial,Helvetica,sans-serif";

function html(body: EmailBody) {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:#141611">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
  const action = body.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(body.action.href)}" style="display:inline-block;padding:14px 22px;background:#d9ad4a;color:#141611;font-family:${SANS};font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(body.action.label)}</a></p>`
    : "";
  const footnote = body.footnote
    ? `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #c6c9b6;font-family:${SANS};font-size:13px;line-height:1.6;color:#53564c">${escapeHtml(body.footnote)}</p>`
    : "";
  return [
    `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f5efdf">`,
    `<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#f5efdf">`,
    `<p style="margin:0 0 24px;padding-bottom:12px;border-bottom:1px solid #c6c9b6;font-family:${SANS};font-size:13px;color:#53564c">${escapeHtml(body.masthead)}</p>`,
    `<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.25;color:#141611">${escapeHtml(body.heading)}</h1>`,
    ...body.paragraphs.map(p),
    action,
    footnote,
    `</div></body></html>`,
  ].join("\n");
}

function text(body: EmailBody) {
  return [
    body.heading,
    "",
    ...body.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(body.action ? [`${body.action.label}: ${body.action.href}`, ""] : []),
    ...(body.footnote ? [body.footnote, ""] : []),
    body.masthead,
  ].join("\n");
}

export function renderEmail(subject: string, body: EmailBody): RenderedEmail {
  return { subject, html: html(body), text: text(body) };
}

export const appUrl = (env: NodeJS.ProcessEnv = process.env) =>
  (env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || "there";
