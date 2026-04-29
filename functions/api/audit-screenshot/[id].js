/**
 * GET /api/audit-screenshot/:id — serves the R2-stored hero screenshot.
 *
 * The jobId is a UUID (effectively unguessable), so no auth needed.
 * Aggressive cache headers because the screenshot is immutable per jobId
 * and the URL gets emailed to the user.
 */

const R2_PREFIX = 'audits/';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const jobId = params?.id;
  if (typeof jobId !== 'string' || !/^[a-f0-9-]{16,64}$/.test(jobId)) {
    return new Response('Invalid id', { status: 400 });
  }

  const key = `${R2_PREFIX}${jobId}.jpg`;
  let object;
  try {
    object = await env.MEDIA_BUCKET.get(key);
  } catch (err) {
    console.error('[Audit Screenshot] R2 get failed:', err);
    return new Response('Not found', { status: 404 });
  }
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=2592000, immutable');
  headers.set('ETag', object.httpEtag);

  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}
