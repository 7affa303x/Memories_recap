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

Add ALL of these (do not replace — keep both local and production):

Authorized JavaScript origins:
- `http://localhost:3000`
- `https://memories-recap-one.vercel.app`

Authorized redirect URIs:
- `http://localhost:3000/api/auth/callback/google`
- `https://memories-recap-one.vercel.app/api/auth/callback/google`

## Data layer

Job metadata is stored in the private Supabase Storage bucket `app-data`
(production-ready path isolation by user id). Video binaries use `memories`
and finished outputs use public `recaps`.

Postgres SQL remains in `supabase/migrations/` for when direct DB access is
available (reset the database password in Supabase if pooler auth fails).

## Deploy

Linked Vercel project: `algeria1/memories-recap`

```bash
npx vercel --prod --scope algeria1
```
