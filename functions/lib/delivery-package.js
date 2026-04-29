/**
 * Delivery Package — collect files from R2, ZIP with fflate, upload to R2
 */

import { zipSync } from 'fflate';
import { sanitizeFilename, buildPackageR2Key, uploadToR2 } from './media-storage.js';

export async function generateDeliveryPackage(env, db, clientId, fileIds, filename) {
  if (!fileIds || fileIds.length === 0) throw new Error('No files specified');

  var bucket = env.MEDIA_BUCKET;
  if (!bucket) throw new Error('MEDIA_BUCKET not configured');

  // Fetch media file rows
  var placeholders = fileIds.map(function() { return '?'; }).join(',');
  var rows = await db.prepare(
    'SELECT * FROM media_files WHERE id IN (' + placeholders + ') AND client_id = ?'
  ).bind(...fileIds, clientId).all();
  var files = rows.results || [];

  if (files.length === 0) throw new Error('No matching files found');

  // Collect file data from R2
  var zipData = {};
  var readmeLines = [
    'Delivery Package',
    '================',
    '',
    'Client ID: ' + clientId,
    'Files: ' + files.length,
    'Created: ' + new Date().toISOString(),
    '',
    'Contents:',
  ];

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      var obj = await bucket.get(file.r2_key);
      if (!obj) {
        console.warn('[DeliveryPackage] File not found in R2:', file.r2_key);
        continue;
      }
      var arrayBuf = await obj.arrayBuffer();
      var safeName = sanitizeFilename(file.filename || ('file_' + i), 200);
      if (!safeName) safeName = 'file_' + i;
      // Avoid duplicate names
      if (zipData[safeName]) {
        var ext = safeName.lastIndexOf('.');
        if (ext > 0) {
          safeName = safeName.slice(0, ext) + '_' + i + safeName.slice(ext);
        } else {
          safeName = safeName + '_' + i;
        }
      }
      zipData[safeName] = new Uint8Array(arrayBuf);
      readmeLines.push('  - ' + safeName + ' (' + (file.file_size || arrayBuf.byteLength) + ' bytes)');
    } catch (err) {
      console.error('[DeliveryPackage] Failed to fetch file:', file.r2_key, err);
    }
  }

  if (Object.keys(zipData).length === 0) throw new Error('No files could be collected from storage');

  // Add README
  readmeLines.push('');
  var readmeText = readmeLines.join('\n');
  zipData['README.txt'] = new TextEncoder().encode(readmeText);

  // Generate ZIP
  var zipped = zipSync(zipData);

  // Upload to R2
  var packageFilename = sanitizeFilename(filename || ('delivery_' + new Date().toISOString().split('T')[0] + '.zip'), 200);
  if (!packageFilename.toLowerCase().endsWith('.zip')) packageFilename += '.zip';
  var r2Key = buildPackageR2Key(clientId, packageFilename);
  await uploadToR2(bucket, r2Key, zipped, 'application/zip');

  // Create DB row with 30-day expiry
  var expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(
    `INSERT INTO delivery_packages (client_id, r2_key, filename, file_size, status, expires_at)
     VALUES (?, ?, ?, ?, 'ready', ?)`
  ).bind(clientId, r2Key, packageFilename, zipped.byteLength, expiresAt).run();

  var pkg = await db.prepare(
    'SELECT * FROM delivery_packages WHERE r2_key = ? AND client_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(r2Key, clientId).first();

  return pkg;
}
