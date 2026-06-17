import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { createServerClient } from '../../../lib/supabase';
import { validateTree } from '../../../lib/familyTree';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as any).user;

  if (!isAdmin(user)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const treeKey = body?.tree_key;
  const data = body?.data;

  if (typeof treeKey !== 'string' || !treeKey) {
    return json({ error: 'Missing tree_key.' }, 400);
  }

  // Server-side safety net: never persist a structurally broken tree.
  const errors = validateTree(data);
  if (errors.length > 0) {
    return json({ error: 'Tree validation failed.', details: errors }, 400);
  }

  const supabase = createServerClient();
  const { data: updated, error } = await supabase
    .from('family_trees')
    .update({ data, label: data.label })
    .eq('tree_key', treeKey)
    .select('tree_key');

  if (error) {
    return json({ error: error.message }, 500);
  }
  if (!updated || updated.length === 0) {
    return json({ error: `No family tree found for "${treeKey}".` }, 404);
  }

  return json({ ok: true }, 200);
};
