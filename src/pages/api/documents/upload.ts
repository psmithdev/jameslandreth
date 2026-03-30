import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { createServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as any).user;

  if (!isAdmin(user)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const title = formData.get('title') as string;
  const category = formData.get('category') as string;

  if (!title || !category) {
    return new Response(JSON.stringify({ error: 'Title and category are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Upload file if provided
  let filePath = '';
  let fileType = 'PDF';
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    fileType = ext === 'pdf' ? 'PDF' : 'Word';
    filePath = `${slug}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Parse tags
  const tagsStr = formData.get('tags') as string;
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Insert document record
  const { error: insertError } = await supabase
    .from('documents')
    .insert({
      slug,
      title,
      category,
      excerpt: formData.get('excerpt') || null,
      date: formData.get('date') || null,
      year: formData.get('year') ? parseInt(formData.get('year') as string) : null,
      location: formData.get('location') || null,
      tags,
      pages: formData.get('pages') || null,
      file_type: fileType,
      file_path: filePath || null,
      featured: formData.get('featured') === 'on',
      status: 'published',
      created_by: user.id,
    });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
