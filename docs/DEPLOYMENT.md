# Deployment Guide

## Local vs production

- Local development uses `.env.local` and your localhost MySQL database.
- Production uses host-managed environment variables, not `.env.local`.
- For Vercel, set environment variables in the Vercel project dashboard.

## Required production environment variables

```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
DATABASE_URL=mysql://doadmin:password@db-mysql-lon1-97811-do-user-34426921-0.d.db.ondigitalocean.com:25060/defaultdb
ADMIN_API_TOKEN=replace_with_long_random_admin_token

STRIPE_SECRET_KEY=sk_live_or_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=paypal_client_id
PAYPAL_CLIENT_SECRET=paypal_client_secret

RESEND_API_KEY=re_xxx
EMAIL_FROM=Global Awakening <noreply@your-domain.com>
ADMIN_NOTIFICATION_EMAIL=admin@your-domain.com
```

## Prisma and database notes

- `postinstall` runs `prisma generate`, which is needed for Vercel builds.
- The repository includes Prisma migrations. For a fresh production database, use:

```bash
npx prisma migrate deploy
```

- If a database was previously created with `prisma db push`, do not run `migrate deploy` blindly against it. Either:
  - baseline that database first, or
  - use a fresh database/schema for production.

## Recommended production flow

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Add all production environment variables in Vercel.
4. Ensure the production database is either:
   - a fresh schema for `prisma migrate deploy`, or
   - already synced and intentionally managed outside migration history.
5. Run database migrations once from a trusted machine or CI job:

```bash
npx prisma migrate deploy
```

6. If you need seed data:

```bash
npm run prisma:seed
```

## Pre-deploy checks

Run locally before pushing:

```bash
npm run lint
npm run typecheck
npm run build
```

## Security notes

- Never commit `.env`, `.env.local`, private keys, or provider secrets.
- Keep `ADMIN_API_TOKEN` long and random.
- Keep Stripe and PayPal secrets only in host environment settings.
- The app already sets common security headers in `next.config.ts`.
