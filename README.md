# Memory Recap

Turn heavy memories into watchable moments.

## Product flow

Landing → Upload → Processing → Result → Share

Google sign-in only. Original videos stay untouched.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Auth.js (Google OAuth)
- Supabase (Storage + SQL migrations)
- Paddle Billing
- FFmpeg processing on the server
- Vercel

## Billing (Paddle)

Pages:
- `/pricing` — Free, Pro Monthly, Credit Packs
- `/billing` — current credits, renewal, portal, invoices

Webhook endpoint:
- `POST /api/webhooks/paddle`

### Live setup

1. Create a **live** Paddle API key → `PADDLE_API_KEY`
2. Run catalog + webhook provisioning:

```bash
PADDLE_API_KEY=pdl_live_... NEXT_PUBLIC_PADDLE_ENV=production npm run setup:paddle
```

3. Copy printed values into `.env.local` and Vercel (Production/Preview/Development):
   - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (`live_…`)
   - `PADDLE_NOTIFICATION_WEBHOOK_SECRET`
   - `PADDLE_PRICE_*`
4. In Paddle dashboard → Checkout → Checkout settings:
   - Default payment link = `https://memories-recap-one.vercel.app/billing`
5. Confirm the live webhook destination is active for
   `https://memories-recap-one.vercel.app/api/webhooks/paddle`

Credits:
- Free one-time grant (`FREE_CREDITS`)
- Subscription grants every cycle
- Packs are one-time
- All credits expire after `CREDIT_EXPIRY_DAYS` (default 90)
- Processing deducts credits before render; failed jobs restore credits

Catalog (USD, mirrored from tested Polar sandbox catalog):
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
