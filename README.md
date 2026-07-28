# Memory Recap

Turn heavy memories into watchable moments.

## Product flow

Landing → Upload → Processing → Result → Share

Google sign-in only. Original videos stay untouched by default.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Auth.js (Google OAuth)
- Supabase private Storage (`memories`, `app-data`, `recaps`)
- Creem Merchant of Record billing
- FFmpeg + optional Gemini/Groq/OpenAI vision scoring
- Vercel

## Billing (Creem)

Pages:
- `/pricing` — Free, Pro Monthly, Credit Packs
- `/billing` — current credits, renewal, portal, invoices

Webhook:
- `POST /api/webhooks/creem` (signed only)

Catalog (USD):
- Pro Monthly — $17 / 2000 credits
- Small pack — $9 / 500 credits
- Medium pack — $29 / 2000 credits
- Large pack — $69 / 5000 credits

## Vision AI

Set any of:
- `GEMINI_API_KEY` (preferred)
- `GROQ_API_KEY`
- `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY`

Without keys, local FFmpeg scene + brightness scoring still runs.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Health check: `GET /api/health`

## Deploy

```bash
npx vercel --prod --scope algeria1
```
