import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function siteUrl(request: Request, slug: string) {
  const url = new URL(request.url);
  url.pathname = `/items/${slug}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function sendClaimNotification({
  artifact,
  claimantName,
  claimantEmail,
  itemUrl,
}: {
  artifact: { title: string; slug: string; category: string | null; family: string | null; estimated_value: string | null };
  claimantName: string;
  claimantEmail: string;
  itemUrl: string;
}) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.CLAIM_NOTIFICATION_EMAIL || 'aledaandjim@yahoo.com';
  const from = import.meta.env.CLAIM_FROM_EMAIL || 'Family Treasures <claims@jameslandreth.com>';

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const lines = [
    `Name: ${claimantName}`,
    `Email: ${claimantEmail}`,
    '',
    `Artifact: ${artifact.title}`,
    `Category: ${artifact.category || 'Not set'}`,
    `Family: ${artifact.family || 'Not set'}`,
    `Estimated value: ${artifact.estimated_value || 'Not set'}`,
    `Link: ${itemUrl}`,
  ];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: claimantEmail,
      subject: `Artifact claimed: ${artifact.title}`,
      text: lines.join('\n'),
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Email notification failed: ${errorText || res.statusText}`);
  }
}

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as any).user;
  const supabase = createServerClient();
  const body = await request.json().catch(() => null);
  const artifactId = typeof body?.artifactId === 'string' ? body.artifactId.trim() : '';
  const claimantName = typeof body?.name === 'string' ? body.name.trim() : '';
  const claimantEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!artifactId) return json({ error: 'Missing artifactId' }, 400);
  if (!claimantName) return json({ error: 'Please enter your name.' }, 400);
  if (!EMAIL_RE.test(claimantEmail)) return json({ error: 'Please enter a valid email address.' }, 400);

  const { data: artifact, error: fetchError } = await supabase
    .from('artifacts')
    .select('id, slug, title, category, family, estimated_value, status')
    .eq('id', artifactId)
    .single();

  if (fetchError || !artifact) {
    return json({ error: 'Artifact not found.' }, 404);
  }

  if (artifact.status !== 'available') {
    return json({ error: 'Item is not available for claiming.' }, 400);
  }

  const claimedAt = new Date().toISOString();
  const { data: claimedArtifact, error: claimError } = await supabase
    .from('artifacts')
    .update({
      status: 'claimed',
      claimed_by: user?.id || null,
      claimed_name: claimantName,
      claimed_email: claimantEmail,
      claimed_at: claimedAt,
    })
    .eq('id', artifactId)
    .eq('status', 'available')
    .select('id')
    .single();

  if (claimError || !claimedArtifact) {
    return json({ error: 'Item is no longer available for claiming.' }, 409);
  }

  try {
    await sendClaimNotification({
      artifact,
      claimantName,
      claimantEmail,
      itemUrl: siteUrl(request, artifact.slug),
    });
  } catch (error: any) {
    await supabase
      .from('artifacts')
      .update({
        status: 'available',
        claimed_by: null,
        claimed_name: null,
        claimed_email: null,
        claimed_at: null,
      })
      .eq('id', artifactId)
      .eq('claimed_at', claimedAt);

    return json({ error: error.message || 'Failed to send claim notification.' }, 502);
  }

  return json({ ok: true });
};
