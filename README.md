# Global Awakening Web

Production-ready Next.js 16 app for the Global Awakening website.

## Stack
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4

## Local Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env file:
   ```bash
   cp .env.example .env.local
   ```
3. Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local development unless you specifically need another local URL.
4. Set `DATABASE_URL` in `.env.local` to your managed DigitalOcean MySQL connection string if you want the project to avoid any local MySQL dependency.
5. Run development server:
   ```bash
   npm run dev
   ```

Using a managed DigitalOcean database means the app, Prisma, and local dev server connect over the network. MySQL Server or MySQL Workbench do not need to be installed on your laptop for this project to run.

## Production Preflight
Run this before every deployment:

```bash
npm run check
```

This runs:
- `lint`
- `typecheck`
- `build`

## Production Build & Start
```bash
npm run build
npm run start
```

Default runtime port is `3000`.

## Deployment Notes
- Minimum Node.js version: `20+`.
- Security headers are configured in `next.config.ts`.
- `X-Powered-By` is disabled.
- Dynamic `robots.txt` and `sitemap.xml` are generated from `NEXT_PUBLIC_APP_URL`.
- If `NEXT_PUBLIC_APP_URL` is missing/invalid, metadata falls back to `https://example.com`.
- Detailed Vercel + Prisma deployment steps are in `docs/DEPLOYMENT.md`.

## Environment Variables
See `.env.example`.

Required for production:
- `NEXT_PUBLIC_APP_URL=https://your-domain.com`
- `DATABASE_URL=mysql://...`
- payment/email env vars if those workflows are enabled

For a laptop-friendly setup, you can also use the same DigitalOcean `DATABASE_URL` in local development.

## Suggested Deploy Targets
- Vercel (zero-config for Next.js)
- Any Node host supporting `next build` + `next start` (Render, Railway, VPS, Docker)

## Quick Deploy Checklist
- [ ] `npm install` completed
- [ ] `.env.local` or host env vars configured
- [ ] `npm run check` passes
- [ ] Domain configured and points to host
- [ ] TLS/HTTPS enabled
