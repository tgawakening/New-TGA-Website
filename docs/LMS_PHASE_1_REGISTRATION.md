# LMS Phase 1: Registration + Pricing + Dashboard Gate

This phase is now implemented in the project.

## Scope
- Student registration with password
- Country-based pricing calculation on backend
- Optional coupon support (global countries only)
- Payment method eligibility by country
- Login + session cookie
- Dashboard gate by enrollment status

## File Responsibility Map
- `prisma/schema.prisma`
  - Database models and enums (users, registrations, payments, enrollments, sessions, pricing rules, coupons).
- `prisma/seed.mjs`
  - Seeds Seerah course and discounted pricing rules for `IN`, `AF`, `BD`.
- `lib/prisma.ts`
  - Shared Prisma client singleton.
- `lib/pricing.ts`
  - Core pricing engine (country/region, coupon validation, allowed payment methods, final amount).
- `lib/validations/registration.ts`
  - Zod schema for registration + login payloads.
- `lib/validations/pricing.ts`
  - Zod schema for pricing endpoint payload.
- `lib/auth/session.ts`
  - Session creation, cookie handling, current user resolution.
- `services/registration.service.ts`
  - Creates user + profile + registration + payment + enrollment.
- `services/auth.service.ts`
  - Email/password login verification.
- `app/api/pricing/route.ts`
  - POST endpoint for price summary.
- `app/api/register/route.ts`
  - POST endpoint to register a student.
- `app/api/login/route.ts`
  - POST endpoint to login.
- `app/api/logout/route.ts`
  - POST endpoint to logout.
- `app/seerah/register/page.tsx`
  - Registration UI with real-time pricing check.
- `app/login/page.tsx`
  - Login UI.
- `app/dashboard/page.tsx`
  - Protected dashboard with LMS access indicator.
- `components/dashboard/logout-button.tsx`
  - Logout action component.

## Current Pricing Rules
- Base course price: `£20.00` (`2000` pence) for global countries.
- Discounted countries: `IN`, `AF`, `BD` -> `PKR 2000`.
- Coupon allowed only for non-discounted countries.

## Current Enrollment Gate
- Registration creates enrollment in `PENDING`.
- LMS access should be granted when enrollment status becomes `ACTIVE`.
- Dashboard already reflects this (`Locked` vs `Granted`).

## Commands
```bash
npm install
npm run prisma:generate
npm run prisma:migrate:dev -- --name init_lms_phase_1
npm run prisma:seed
npm run dev
```

## Next Phase
- Stripe + PayPal + manual payment evidence flow
- Admin review/approval actions to move `PENDING` to `ACTIVE`
- Email notifications (student + admin)
