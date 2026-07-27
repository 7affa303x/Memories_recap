# Memory Recap

Turn heavy memories into watchable moments.

## Product flow

Landing → Upload → Processing → Result → Share

Google sign-in only. Original videos stay untouched.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Auth.js (Google OAuth)
- Supabase (Storage + SQL migrations)
- Creem Merchant of Record billing
- FFmpeg processing on the server
- Vercel

## Billing (Creem)

Pages:
- `/pricing` — Free, Pro Monthly, Credit Packs
- `/billing` — current credits, renewal, portal, invoices

Webhook endpoint:
- `POST /api/webhooks/creem`

### Setup

1. Create a Creem account and API key (`creem_test_…` or live)
2. Create products (or run `npm run setup:creem`)
3. Set env vars (`CREEM_API_KEY`, `CREEM_PRODUCT_*`, `CREEM_WEBHOOK_SECRET`)
4. In Creem dashboard → Developers → Webhooks, add:
   `https://memories-recap-one.vercel.app/api/webhooks/creem`
5. Copy the webhook signing secret into `CREEM_WEBHOOK_SECRET`

Creem is the Merchant of Record — customers pay Creem, Creem pays you out (bank or USDC). No Stripe Connect onboarding for sellers.

Credits:
- Free one-time grant (`FREE_CREDITS`)
- Subscription grants every cycle
- Packs are one-time
- All credits expire after `CREDIT_EXPIRY_DAYS` (default 90)

Catalog (USD):
- Pro Monthly — $17 / 2000 credits
- Small pack — $9 / 500 credits
- Medium pack — $29 / 2000 credits
- Large pack — $69 / 5000 credits

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
