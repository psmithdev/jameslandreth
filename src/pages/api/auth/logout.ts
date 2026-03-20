import type { APIRoute } from 'astro';
import { clearAuthCookies } from '../../../lib/auth';

export const GET: APIRoute = async () => {
  const headers = new Headers();
  clearAuthCookies(headers);
  headers.set('Location', '/');

  return new Response(null, { status: 302, headers });
};
