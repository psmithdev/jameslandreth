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

  const { artifactId } = await request.json();

  if (!artifactId) {
    return new Response(JSON.stringify({ error: 'Missing artifactId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check artifact is available
  const { data: artifact } = await supabase
    .from('artifacts')
    .select('status')
    .eq('id', artifactId)
    .single();

  if (!artifact || artifact.status !== 'available') {
    return new Response(JSON.stringify({ error: 'Item is not available for claiming' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Claim it
  const { error } = await supabase
    .from('artifacts')
    .update({
      status: 'claimed',
      claimed_by: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', artifactId);

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
