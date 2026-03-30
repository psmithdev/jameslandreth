# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal document archive and family heirloom site for Dr. James Landreth. Two domains served from a single Astro SSR app:

- **jameslandreth.com** — Document archive (essays, newsletters, travel journals, personal narratives)
- **artifacts.jameslandreth.com** — Family Treasures (heirlooms, antiques, family possessions)

## Tech Stack

- **Astro 6** with Node adapter (`output: 'server'`, standalone mode)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (not the legacy PostCSS integration)
- **Supabase** — Postgres + Auth + Storage
- **TypeScript** (strict mode)

## Development

```bash
npm run dev          # http://localhost:4321
npm run build
npm run preview
```

### Environment Variables

Copy `.env.example` to `.env`:

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=          # required for artifact import scripts only
```

## Architecture

### Host-Based Routing

`src/middleware.ts` inspects the `Host` header on every request:
- `artifacts.*` → rewrites to `/artifacts/*` pages
- everything else → rewrites to `/main/*` pages

API routes (`/api/`), static assets (`/_`), and already-prefixed paths are passed through without rewriting. The active site is available as `locals.site` (`'main'` | `'artifacts'`).

### Auth Flow

Session tokens are stored in two HttpOnly cookies (`sb-access-token`, `sb-refresh-token`). The middleware reads those cookies, calls Supabase to validate, and attaches `locals.user` (a `UserProfile`) and `locals.supabase` (a user-scoped client) to every request.

### Supabase Client Factories (`src/lib/supabase.ts`)

Three clients with distinct purposes — use the right one:

| Factory | Key | RLS | Where to use |
|---|---|---|---|
| `createBrowserClient()` | anon | enforced | Client-side `<script>` tags |
| `createUserClient(token)` | anon + JWT | enforced as user | Server pages/API when you have a session |
| `createServerClient()` | service role | **bypassed** | Admin scripts, migrations only |

### Role Checks (`src/lib/auth.ts`)

```ts
isAdmin(profile)         // role === 'admin'
isFamily(profile)        // role === 'family' || 'admin'
isAuthenticated(profile) // profile !== null
```

### Page Structure

```
src/pages/
  main/
    index.astro           # jameslandreth.com home
    docs/[slug].astro     # individual document view
    upload.astro          # admin document upload
    admin.astro           # admin dashboard
    login.astro
    family-tree.astro
  artifacts/
    index.astro           # artifacts.jameslandreth.com home
    items/[slug].astro    # individual artifact view
    admin.astro           # admin artifact dashboard
  api/auth/               # Supabase auth callback + logout endpoints
```

## Database Schema

Tables: `profiles`, `documents`, `artifacts`, `comments`

Key points:
- New Supabase users automatically get a `profiles` row via `handle_new_user()` trigger.
- `documents.status` (`published`/`draft`/`archived`) gates RLS — only `published` docs are public.
- `artifacts.status` (`available`/`claimed`/`gifted`) — all artifacts are publicly visible.
- `comments.target_type` enum (`document` | `artifact`) links comments to either table.
- Storage buckets required: `documents`, `thumbnails`, `artifacts`, `avatars` (create via Supabase Dashboard).

Migrations: `supabase/migrations/`. Apply via Supabase CLI (`supabase db push`) or Dashboard SQL editor.

## Artifact Import Scripts

One-time data-import pipeline in `scripts/`. Requires `ANTHROPIC_API_KEY` and the service role key in `.env`. Drop source photos into `tmp/artifact-photos/` before running.

```bash
npm run classify-photos   # Claude vision → tmp/photo-proposals.json
npm run review-photos     # Browser UI to accept/reject proposals
npm run propose-artifacts # Generate artifact records from accepted proposals
npm run upload-photos     # Upload accepted images to Supabase Storage
```

## Deployment

Target: VPS with Caddy (reverse proxy + HTTPS) + PM2 (process manager). Config in `deploy/`.
Legacy static site still on `gh-pages` branch (GitHub Pages).

## Commit & Pull Request Guidelines

- Short imperative subjects: `Add`, `Fix`, `Refactor`, `Update` — under 72 chars
- One commit per logical change; brief body only if reason isn't obvious
- PRs need summary, rationale, linked task ID (if any), and screenshots for UI changes
