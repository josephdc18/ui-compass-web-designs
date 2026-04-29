/**
 * Portal Packages API alias.
 * Forwards /api/portal/packages/* requests to /api/portal/media/packages/*.
 */
import { onRequest as onMediaRequest } from '../media/[[path]].js';

export async function onRequest(context) {
  var params = context.params || {};
  var raw = params.path;
  var pathParts = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  var nextParams = Object.assign({}, params, { path: ['packages'].concat(pathParts) });
  var forwarded = Object.assign({}, context, { params: nextParams });
  return onMediaRequest(forwarded);
}
