# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal document archive and family heirloom site for Dr. James Landreth, a retired doctor, traveler, photographer, and writer. Two domains served from a single Astro SSR app:

- **jameslandreth.com** — Document archive (essays, newsletters, travel journals, personal narratives)
- **artifacts.jameslandreth.com** — Family Treasures (heirlooms, antiques, family possessions)

## Architecture

**Astro 6 SSR** app with Node adapter, backed by **Supabase** (Postgres + Auth + Storage). Middleware inspects the `Host` header to route between the main site and artifacts subdomain.

### Key Directories

```
src/
  layouts/          # MainLayout.astro, ArtifactsLayout.astro
  lib/              # supabase.ts (client factories), auth.ts (session/role helpers)
  middleware.ts     # Host-based routing (main vs artifacts)
  pages/
    main/           # Pages for jameslandreth.com
    artifacts/      # Pages for artifacts.jameslandreth.com
    api/auth/       # Auth callback and logout endpoints
  styles/global.css # Tailwind CSS v4 entry point
  components/       # Shared and page-specific components
supabase/
  migrations/       # SQL migration files
legacy/             # Original static HTML files for reference
deploy/             # Caddy + PM2 config (future)
```

### Three User Tiers

- **admin** — Full CRUD on documents and artifacts
- **family** — Comment, claim artifacts, access private docs
- **public** — Browse published content

## Tech Stack

- **Astro 6** with Node adapter (SSR mode)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Supabase** — Postgres, Auth, Storage
- **TypeScript** (strict mode)

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:4321)
npm run build        # Production build
npm run preview      # Preview production build
```

### Environment Variables

Copy `.env.example` to `.env` and fill in Supabase credentials:

```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Database Schema

Tables: `profiles`, `documents`, `artifacts`, `comments`
Enums: `user_role`, `document_status`, `artifact_status`, `target_type`

Migrations are in `supabase/migrations/`. Apply via Supabase CLI or Dashboard.

## Content Categories

Health, Fashion, Food, Shopping, Events, Fiction, Travel (especially Japan), Education, Family History, Photography, Music, Annual Adventures, Personal Essays

## Deployment

Target: VPS with Caddy (reverse proxy + HTTPS) + PM2 (process manager).
Legacy deployment on GitHub Pages from `gh-pages` branch still active.

## Commit & Pull Request Guidelines

### Commits

- Use short, imperative subjects: Add …, Fix …, Refactor …, Update …
- One commit per logical change.
- Keep subject under 72 characters.
- Add a brief body only if the reason is not obvious.

### Pull Requests

Include:

- Clear summary and rationale
- Linked issue/task ID (if available)
- Screenshots or short recordings for UI changes
- Notes on environment/config updates (only if changed)
