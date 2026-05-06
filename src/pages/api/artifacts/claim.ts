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
  artifact: { title: string; slug: string; category: string | null; family: string | null; estimated_value: string | null; images: string[] | null };
  claimantName: string;
  claimantEmail: string;
  itemUrl: string;
}) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const toRaw = import.meta.env.CLAIM_NOTIFICATION_EMAIL || 'aledaandjim@yahoo.com';
  const to = toRaw
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const from = import.meta.env.CLAIM_FROM_EMAIL || 'Family Treasures <claims@jameslandreth.com>';

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const detailRows: Array<[string, string]> = [];
  if (artifact.category) detailRows.push(['Category', artifact.category]);
  if (artifact.family) detailRows.push(['Family', artifact.family]);
  if (artifact.estimated_value) detailRows.push(['Estimated value', artifact.estimated_value]);

  const textLines = [
    `Name: ${claimantName}`,
    `Email: ${claimantEmail}`,
    '',
    `Artifact: ${artifact.title}`,
    ...detailRows.map(([k, v]) => `${k}: ${v}`),
    `Link: ${itemUrl}`,
  ];

  const photoUrl = artifact.images && artifact.images.length > 0 ? artifact.images[0] : null;
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const photoBlock = photoUrl
    ? `<tr><td style="padding:0 32px 24px;"><img src="${escape(photoUrl)}" alt="${escape(artifact.title)}" width="280" style="border-radius:12px;display:block;max-width:100%;height:auto;margin:0 auto;" /></td></tr>`
    : '';

  const detailsHtml = detailRows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 0;color:#6b6359;font-size:14px;width:140px;">${escape(k)}</td><td style="padding:4px 0;color:#2a2622;font-size:14px;">${escape(v)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f4ede0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2a2622;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;margin:0 auto;background:#faf6ee;border-radius:16px;overflow:hidden;">
    <tr><td style="padding:32px 32px 0;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a8d7a;margin-bottom:8px;">Family Treasures</div>
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;margin:0 0 8px;color:#2a2622;">${escape(artifact.title)}</h1>
      <div style="font-size:14px;color:#6b6359;margin-bottom:24px;">has been claimed.</div>
    </td></tr>
    ${photoBlock}
    <tr><td style="padding:0 32px 24px;">
      <div style="background:#fff;border-radius:12px;padding:20px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9a8d7a;margin-bottom:8px;">Claimed by</div>
        <div style="font-size:16px;color:#2a2622;margin-bottom:4px;">${escape(claimantName)}</div>
        <a href="mailto:${escape(claimantEmail)}" style="font-size:14px;color:#5b8c5a;text-decoration:none;">${escape(claimantEmail)}</a>
      </div>
    </td></tr>
    ${
      detailsHtml
        ? `<tr><td style="padding:0 32px 24px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${detailsHtml}</table></td></tr>`
        : ''
    }
    <tr><td style="padding:0 32px 32px;" align="center">
      <a href="${escape(itemUrl)}" style="display:inline-block;background:#5b8c5a;color:#fff;text-decoration:none;font-size:15px;padding:12px 28px;border-radius:999px;font-weight:600;">View item</a>
    </td></tr>
    <tr><td style="padding:0 32px 24px;border-top:1px solid #ebe2d2;">
      <div style="font-size:11px;color:#9a8d7a;margin-top:16px;text-align:center;">You're receiving this because you administer the Family Treasures site.</div>
    </td></tr>
  </table>
</body></html>`;

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
      text: textLines.join('\n'),
      html,
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
    .select('id, slug, title, category, family, estimated_value, status, images')
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
