import type { APIRoute } from 'astro';
import { isFamily } from '../../../lib/auth';

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as any).user;
  const supabase = (locals as any).supabase;

  if (!isFamily(user) || !supabase) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { targetType, targetId, body } = await request.json();

  if (!targetType || !targetId || !body?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase
    .from('comments')
    .insert({
      target_type: targetType,
      target_id: targetId,
      author_id: user.id,
      body: body.trim(),
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
