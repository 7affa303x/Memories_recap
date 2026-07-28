# Memories Recap

Turn heavy memories into watchable moments.

## Product flow

Landing → Upload → Processing → Result → Share

Google sign-in only. Original videos stay untouched by default.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Auth.js (Google OAuth)
- Supabase private Storage (`memories`, `app-data`, `recaps`)
- Creem Merchant of Record billing (live)
- FFmpeg + optional Gemini/Groq/OpenAI vision scoring
- Vercel

## Live site

https://memories-recap-one.vercel.app

## Billing (Creem)

Pages:
- `/pricing` — Free, Pro Monthly, Credit Packs
- `/billing` — current credits, renewal, portal, invoices

Webhook:
- `POST /api/webhooks/creem` (signed only)

## Optional env

- `RESEND_API_KEY` — email when recap is ready
- `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_TIKTOK_PIXEL_ID` — ads pixels
- `GEMINI_API_KEY` / `GROQ_API_KEY` — vision scoring

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Health check: `GET /api/health`
