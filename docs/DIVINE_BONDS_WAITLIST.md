# Divine Bonds waitlist

All Connect for Akhirah phases are Coming Soon. Only Divine Bonds accepts expressions of interest; the other phase buttons are disabled.

The waitlist collects name, email, country and calling code, phone, interest category, a short explanation, and consent to contact. It uses the existing flag picker and email/database configuration. No schema migration or new environment variables are required.

Submissions are saved in the existing EmailLog table as DIVINE_BONDS_WAITLIST, with structured contact/interest data. Notifications go to Enquiries.awakeningteam@outlook.com through the existing RESEND_API_KEY and EMAIL_FROM configuration. Successful delivery marks the enquiry NOTIFIED. Failed/skipped delivery leaves it NOTIFICATION_PENDING for operational review; a repeat same-day submission retries pending notification delivery. Already-notified same-day submissions return the original reference without another email. There is no background delivery retry worker.

Checks: npm run build; npm run lint; node scripts/test-divine-bonds.cjs. The isolated service tests mock database and email delivery; browser submission checks intercept the endpoint and never create real entries or send email.
