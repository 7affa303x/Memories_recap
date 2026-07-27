# Memory Recap

Turn heavy memories into watchable moments.

## Product flow

Landing → Upload → Processing → Result → Share

Google sign-in only. Original videos stay untouched.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Auth.js (Google OAuth)
- Supabase (Postgres + Storage)
- FFmpeg processing on the server
- Vercel

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Required env

| Key | Purpose |
|---|---|
| `AUTH_SECRET` | Auth.js session secret |
| `AUTH_URL` | App URL (`http://localhost:3000`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key |
| `DATABASE_URL` | Postgres connection string |
| `SETUP_SECRET` | Protects `/api/setup/migrate` |

### Google Cloud

Authorized redirect URI:

`http://localhost:3000/api/auth/callback/google`

After deploy, add the production callback too.

### Database migration

Apply schema once:

```bash
curl -X POST "$AUTH_URL/api/setup/migrate" \
  -H "x-setup-secret: $SETUP_SECRET"
```

Or paste `supabase/migrations/20260727170000_initial.sql` into the Supabase SQL editor.

## Deploy

Linked Vercel project: `algeria1/memories-recap`

```bash
npx vercel --prod --scope algeria1
```
