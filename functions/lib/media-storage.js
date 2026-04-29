/**
 * Media Storage — R2 upload/download/delete helpers and filename sanitization
 */

export function sanitizeFilename(name, maxLen = 200) {
  if (!name) return 'file';
  var sanitized = String(name)
    .replace(/\.\.\/|\.\.\\|\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+/, '')
    .replace(/[._-]+$/, '');
  if (!sanitized) return 'file';
  return sanitized.slice(0, maxLen);
}

export function buildR2Key(clientId, filename) {
  var uuid = crypto.randomUUID();
  var safe = sanitizeFilename(filename);
  return 'media/' + clientId + '/' + uuid + '/' + safe;
}

export function buildPackageR2Key(clientId, filename) {
  var uuid = crypto.randomUUID();
  var safe = sanitizeFilename(filename);
  if (!safe.endsWith('.zip')) safe += '.zip';
  return 'packages/' + clientId + '/' + uuid + '/' + safe;
}

export async function uploadToR2(bucket, key, data, contentType) {
  var opts = {};
  if (contentType) opts.httpMetadata = { contentType: contentType };
  await bucket.put(key, data, opts);
  return key;
}

export async function downloadFromR2(bucket, key) {
  var obj = await bucket.get(key);
  if (!obj) return null;
  return obj;
}

export async function deleteFromR2(bucket, key) {
  await bucket.delete(key);
}
