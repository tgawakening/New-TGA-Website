// Routine student updates do not need a second copy in the staff inbox.
const studentOnly = new Set([
  "REGISTERED", "PAYMENT_RESUME", "INVITATION", "RENEWAL_DUE", "COMPLETED", "REJECTED",
]);
const adminOnly = new Set([
  "CHECKOUT_REVIEW", "REFUND_PENDING", "BILLING_REVIEW", "INVITATION_PENDING",
]);

export function sirahNoticeAudience(kind: string): "STUDENT" | "ADMIN" | "BOTH" {
  return studentOnly.has(kind) ? "STUDENT" : adminOnly.has(kind) ? "ADMIN" : "BOTH";
}

export function uniqueEmailRecipients(emails: string[]) {
  return [...new Set(emails.map(email => email.trim().toLowerCase()).filter(Boolean))];
}

export function sirahNoticeRecipients(kind: string, student: string, admins: string[]) {
  const audience = sirahNoticeAudience(kind);
  return uniqueEmailRecipients([
    ...(audience !== "ADMIN" ? [student] : []),
    ...(audience !== "STUDENT" ? admins : []),
  ]);
}
