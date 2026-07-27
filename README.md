# Memory Recap

Turn heavy memories into watchable moments.

## Product flow

Landing → Upload → Processing → Result → Share

Google sign-in only. Original videos stay untouched.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Auth.js (Google OAuth)
- Supabase (Storage + SQL migrations)
- Polar.sh billing
- FFmpeg processing on the server
- Vercel

## Billing (Polar)

Pages:
- `/pricing` — Free, Pro Monthly, Credit Packs
- `/billing` — current credits, renewal, portal, invoices

Webhook endpoint:
- `POST /api/webhooks/polar`

### Polar setup

1. Create an Organization Access Token → `POLAR_ACCESS_TOKEN`
2. Create products in Polar dashboard:
   - Monthly Subscription
   - Small / Medium / Large credit packs
3. Put product IDs in env (`POLAR_PRODUCT_*`)
4. Add webhook to `https://memories-recap-one.vercel.app/api/webhooks/polar`
   Events: checkout updated, order paid, subscription created/updated/canceled, refund created
5. Put signing secret in `POLAR_WEBHOOK_SECRET`

Credits:
- Free one-time grant (`FREE_CREDITS`)
- Subscription grants every cycle
- Packs are one-time
- All credits expire after `CREDIT_EXPIRY_DAYS` (default 90)
- Processing deducts credits before render; failed jobs restore credits

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Google Cloud

Keep both local and production origins/redirects:

- `http://localhost:3000`
- `https://memories-recap-one.vercel.app`
- callbacks under `/api/auth/callback/google`

## Deploy

```bash
npx vercel --prod --scope algeria1
```
