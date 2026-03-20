import type { APIRoute } from 'astro';
import { setAuthCookies } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { access_token, refresh_token } = body;

  if (!access_token || !refresh_token) {
    return new Response(JSON.stringify({ error: 'Missing tokens' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  setAuthCookies(headers, access_token, refresh_token);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
