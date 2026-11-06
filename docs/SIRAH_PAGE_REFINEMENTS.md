# Sīrah page refinement

The existing campaign artwork, topic mapping, content sequence and charcoal/ivory/gold direction are preserved. Section spacing is 80px desktop, 60px tablet and 44px mobile, with the adjoining Course Details/Fees padding reduced to a combined 80/64/48px. Supporting body copy is enlarged to 16px, with darker text on ivory and lighter text on charcoal. Gallery hierarchy and action placement are consistent; the active teaching step includes an underline and a visible “Selected” label.

The video column has a heading and supporting line, an obvious English/Urdu selection, a 300px maximum portrait player and a restrained frame. Language suggestions, explicit-choice persistence, click-to-play, full 9:16 framing and pause-on-switch remain intact. Header and both footer backgrounds are styled only within `/seerah`.

## Closing texture

Asset commit `4bb37c9` supplies `public/Seerah new/Ancient desert glow in charcoal.png`. That is the actual filename; the brief's `seerah-closing-texture.png` is not present. The supplied image is used as a static decorative CSS background **only** behind the closing registration section. Its quiet centre sits behind the heading with a light charcoal overlay. FAQ surfaces remain plain.

## Public and protected groups

The two public regional groups supplied in chat are configured in `components/seerah/course-config.ts` and shown before registration, with clear Pakistan/overseas labels. Fee enquiries select the corresponding public group. These are independent from protected paid course invitations; joining does not confirm enrolment or payment.

The protected confirmation endpoint continues to require authenticated ownership, a server-verified PAID record and eligible access. The stored registration country determines its region. Monthly students become eligible after the first verified charge; upfront students after verified full payment. Browser query parameters do not grant access. Pending online orders perform at most five delayed, idempotent server verification attempts, retain the manual check action, and stop when the payment is no longer processing or the page unmounts.

The confirmation screen shows “Payment confirmed.” and, when configured, “Join your course WhatsApp group for class updates.” with a “Join the Course Group” button. Missing regional destinations show a course-team contact option, without an invented invitation or forced redirect.

**Host setting still required:** In DigitalOcean `tga-app` → website component → Settings → Environment Variables, set the encrypted **runtime** variable `SIRAH_INTERNATIONAL_GROUP_URL` to the paid course invitation from the private refinement brief, then deploy the updated settings. The actual protected invitation is deliberately absent from this public repository and client bundles. The connected DigitalOcean tools cover droplets, not App Platform environment updates, so that host change could not be performed here. The git-ignored local server setting contains the supplied URL for review.

`SIRAH_PAKISTAN_COUNTRY_CODE` defaults to `PK` and provides the central routing rule. Keep `SIRAH_PAKISTAN_GROUP_URL` unset until a paid Pakistan course destination is approved; do not substitute the new public enquiry group. Other payment activation requirements and approved prices remain unchanged. No database migration is added for these refinements.

## Review

Screenshots: [desktop](sirah-registration/refined-1440.png), [mobile](sirah-registration/refined-390.png).

Validation covers five widths (360, 390, 768, 1024, 1440), readable contrast, no page overflow, joined section spacing, both public group destinations, private invitation absence on the landing page, footer scope, closing texture, language persistence, video playback/switching, gallery navigation/exploration, teaching selection and registration preferences. Database workflow tests include first-month/upfront international eligibility, missing Pakistan paid destination and private invitation absence from ordinary order payloads.

Final checks: production build, lint and TypeScript passed; all 25 isolated database workflow tests and 5 campaign tests passed. Production-mode HTTP/browser fixtures verified GB monthly and US upfront confirmations and Pakistan contact fallback, with success-query tampering rejected before settlement. These are isolated synthetic settlements, not real gateway charges. The approved private destination does not appear in tracked source or client bundles.
