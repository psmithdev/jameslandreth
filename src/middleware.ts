import { defineMiddleware } from 'astro:middleware';
import { getAccessToken, getRefreshToken, getUserProfile } from './lib/auth';
import { createUserClient } from './lib/supabase';

/**
 * Host-based routing middleware.
 *
 * Routes requests based on the Host header:
 * - artifacts.* → /artifacts/* pages
 * - everything else → /main/* pages
 *
 * Also handles auth: extracts session from cookies and attaches
 * the user profile to locals for use in pages.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, locals, redirect } = context;
  const host = request.headers.get('host') || '';

  // Determine which site we're serving
  const isArtifacts = host.startsWith('artifacts.');
  (locals as any).site = isArtifacts ? 'artifacts' : 'main';

  // Try to load user session from cookies
  const accessToken = getAccessToken(request);
  if (accessToken) {
    const supabase = createUserClient(accessToken);
    const profile = await getUserProfile(supabase);
    (locals as any).user = profile;
    (locals as any).supabase = supabase;
  } else {
    (locals as any).user = null;
    (locals as any).supabase = null;
  }

  // Host-based rewriting: rewrite root paths to the correct page directory
  const pathname = url.pathname;

  // Skip rewriting for API routes, static assets, and already-prefixed paths
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_') ||
    pathname.startsWith('/main/') ||
    pathname.startsWith('/artifacts/')
  ) {
    return next();
  }

  // Rewrite the URL to the appropriate directory
  const prefix = isArtifacts ? '/artifacts' : '/main';
  const newPath = pathname === '/' ? prefix : `${prefix}${pathname}`;

  return context.rewrite(newPath);
});
