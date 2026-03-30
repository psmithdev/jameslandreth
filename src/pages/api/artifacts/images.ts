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
  const artifactId = formData.get('artifactId') as string;

  if (!artifactId) {
    return new Response(JSON.stringify({ error: 'artifactId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Collect all file entries
  const files: File[] = [];
  for (const [, value] of formData.entries()) {
    if (value instanceof File && value.size > 0) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return new Response(JSON.stringify({ error: 'No files provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient();

  // Look up artifact to get slug
  const { data: artifact, error: fetchError } = await supabase
    .from('artifacts')
    .select('slug, images')
    .eq('id', artifactId)
    .single();

  if (fetchError || !artifact) {
    return new Response(JSON.stringify({ error: 'Artifact not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newUrls: string[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const fileName = `${baseName}-${Date.now()}.${ext}`;
    const storagePath = `${artifact.slug}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('artifacts')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Upload failed: ${uploadError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from('artifacts')
      .getPublicUrl(storagePath);

    newUrls.push(publicUrlData.publicUrl);
  }

  // Append new URLs to existing images array
  const existingImages = artifact.images || [];
  const { error: updateError } = await supabase
    .from('artifacts')
    .update({ images: [...existingImages, ...newUrls] })
    .eq('id', artifactId);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, urls: newUrls }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const user = (locals as any).user;

  if (!isAdmin(user)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { artifactId, imageUrl } = await request.json();

  if (!artifactId || !imageUrl) {
    return new Response(JSON.stringify({ error: 'artifactId and imageUrl are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient();

  // Extract storage path from the public URL
  // URL format: https://<project>.supabase.co/storage/v1/object/public/artifacts/<path>
  const urlObj = new URL(imageUrl);
  const pathParts = urlObj.pathname.split('/storage/v1/object/public/artifacts/');
  const storagePath = pathParts[1];

  if (storagePath) {
    const { error: removeError } = await supabase.storage
      .from('artifacts')
      .remove([decodeURIComponent(storagePath)]);

    if (removeError) {
      return new Response(JSON.stringify({ error: `Storage removal failed: ${removeError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Remove URL from artifact's images array
  const { data: artifact } = await supabase
    .from('artifacts')
    .select('images')
    .eq('id', artifactId)
    .single();

  const updatedImages = (artifact?.images || []).filter((url: string) => url !== imageUrl);

  const { error: updateError } = await supabase
    .from('artifacts')
    .update({ images: updatedImages })
    .eq('id', artifactId);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
