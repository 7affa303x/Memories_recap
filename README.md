# Memories Recap

Turn heavy memories into watchable moments.

## Product flow

Landing → Upload → Processing → Result → Share

Google sign-in only. Original videos stay untouched by default.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Auth.js (Google OAuth)
- Supabase private Storage (`memories`, `app-data`, `recaps`)
- Vercel Blob for large uploads (files above ~45 MB)
- Billing: Gumroad primary merchant of record, Creem as fallback
- FFmpeg + optional Gemini/Groq/OpenAI vision scoring
- Vercel

## Live site

https://memories-recap-one.vercel.app

## Billing

Pages:
- `/pricing` — Free vs Pro, credit packs
- `/billing` — current credits, renewal, portal
- `/account` — export data, receipt JSON, or delete account

Webhooks:
- `POST /api/webhooks/gumroad` (when `BILLING_PROVIDER=gumroad`)
- `POST /api/webhooks/creem` (signed; Creem fallback)

Set `BILLING_PROVIDER=gumroad` or `creem`. When unset, Gumroad is preferred if a token and permalink are present.

Receipts: `GET /api/account/invoices` returns credit ledger / transaction history as downloadable JSON (partial invoice history).

## Optional env

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob for large video uploads
- `RESEND_API_KEY` — welcome email + email when recap is ready
- `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_TIKTOK_PIXEL_ID` — ads pixels (cookie banner)
- `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` — vision scoring
- `DAILY_LOGIN_CREDITS` — optional override (default 30)
- `BILLING_SELF_TEST_EMAILS` / `GUMROAD_SELLER_EMAIL` — soft self-purchase skip list
- `REFERRALS_ENABLED` — invite link UI (`?ref=userId`); see `src/lib/flags.ts`

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Tests: `npm test`

Health check: `GET /api/health`
