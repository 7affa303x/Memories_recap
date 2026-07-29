# Memories Recap

Turn heavy memories into watchable moments.

## Higgsfield app (current)

The product now runs as a **Higgsfield app** (Sign in with Higgsfield + Seedance video generation), built with Cursor + Higgsfield MCP instead of Claude Code / VS Code.

- Live: https://memories-recap.higgsfield.app
- Flow: pick a mood (Joyful / Nostalgic / Chill / Epic) → add a memory photo → generate a calm share-ready film
- Auth & credits: Higgsfield account
- Stack: React 19 + TanStack Start on Cloudflare Workers, Quanta UI, fnf SDK, D1 prefs/favorites

This GitHub repo keeps the earlier Next.js / Vercel MVP history for reference. New product work continues on the Higgsfield app.

## Legacy Next.js MVP (archived in branches)

Earlier cloud-agent branches shipped a Next.js App Router MVP (Auth.js Google OAuth, Supabase, FFmpeg smart-select, billing). Those branches remain under `cursor/*` for history; they are not the primary product surface anymore.
