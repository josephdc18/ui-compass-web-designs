/**
 * Hash-chained audit trail for contract signing.
 * Each event's hash includes the previous event's hash, creating an immutable chain.
 */

import { hashChainEvent, canonicalizeEventData } from './esign-crypto.js';

/**
 * Record an event in the signature_events chain.
 * Handles seq allocation with retry on UNIQUE constraint violation.
 */
export async function recordEvent(db, { contractId, eventType, data, actor, ip, userAgent }) {
  const timestamp = new Date().toISOString();
  const canonical = canonicalizeEventData(data || {});

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const prev = await db.prepare(
        'SELECT seq, event_hash FROM signature_events WHERE contract_id = ? ORDER BY seq DESC LIMIT 1'
      ).bind(contractId).first();

      const seq = (prev?.seq || 0) + 1;
      const prevHash = prev?.event_hash || null;
      const eventHash = await hashChainEvent(prevHash, eventType, data || {}, timestamp);

      await db.prepare(
        `INSERT INTO signature_events (contract_id, seq, event_type, event_data, event_hash, prev_hash, actor, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(contractId, seq, eventType, canonical, eventHash, prevHash, actor || null, ip || null, userAgent || null, timestamp).run();

      return { eventId: seq, eventHash, seq };
    } catch (e) {
      if (attempt === 0 && String(e.message || '').includes('UNIQUE')) continue;
      throw e;
    }
  }
  throw new Error('Failed to allocate sequence number after retry');
}

/**
 * Get the complete event chain for a contract.
 */
export async function getEventChain(db, contractId) {
  const rows = await db.prepare(
    'SELECT * FROM signature_events WHERE contract_id = ? ORDER BY seq ASC'
  ).bind(contractId).all();
  return rows.results || [];
}

/**
 * Verify chain integrity — recompute each hash and compare.
 */
export async function verifyChain(db, contractId) {
  const events = await getEventChain(db, contractId);
  const errors = [];

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    if (evt.seq !== i + 1) errors.push(`Event ${i}: expected seq ${i+1}, got ${evt.seq}`);
    const expectedPrev = i === 0 ? null : events[i-1].event_hash;
    if (evt.prev_hash !== expectedPrev) errors.push(`Event ${evt.seq}: prev_hash mismatch`);

    let parsedData = {};
    try { parsedData = JSON.parse(evt.event_data || '{}'); } catch {}
    const recomputed = await hashChainEvent(evt.prev_hash, evt.event_type, parsedData, evt.created_at);
    if (recomputed !== evt.event_hash) errors.push(`Event ${evt.seq}: hash mismatch (recomputed ${recomputed.slice(0,8)}... vs stored ${evt.event_hash.slice(0,8)}...)`);
  }

  return { valid: errors.length === 0, eventCount: events.length, errors };
}
