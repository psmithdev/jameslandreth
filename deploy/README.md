# Deployment

This site is deployed to **Cloudflare Pages**.

## Setup

1. Connect the GitHub repo to Cloudflare Pages (Workers & Pages → Create → Pages → Connect to Git)
2. Build command: `npm run build`
3. Build output directory: `dist`
4. Node.js version env var: `NODE_VERSION = 20`

## Environment Variables

Set in Cloudflare Pages dashboard → Settings → Environment variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Secret)

## Custom Domains

Both `jameslandreth.com` and `artifacts.jameslandreth.com` are added as custom domains in the Pages project settings.

## Deploys

Every push to `main` triggers an automatic deploy. Preview deploys are created for PRs.
