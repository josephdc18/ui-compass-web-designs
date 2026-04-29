/**
 * E-sign cryptographic utilities — OTP, hash chain, magic link tokens.
 * Uses security.js helpers (sha256, generateToken, secureCompare).
 */

import { sha256, generateToken, secureCompare } from './security.js';

/**
 * Generate a 6-digit OTP.
 * @returns {{ plain: string, hash: string }}
 */
export async function generateOTP() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const num = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  const plain = String(num % 1000000).padStart(6, '0');
  const hash = await sha256(plain);
  return { plain, hash };
}

/**
 * Verify an OTP against a stored hash.
 */
export async function verifyOTP(input, storedHash) {
  const inputHash = await sha256(String(input).trim());
  return secureCompare(inputHash, storedHash);
}

/**
 * Hash chain event: SHA256(prevHash|eventType|canonicalData|timestamp)
 */
export async function hashChainEvent(prevHash, eventType, eventData, timestamp) {
  const canonical = canonicalizeEventData(eventData);
  const str = (prevHash || '') + '|' + eventType + '|' + canonical + '|' + timestamp;
  return sha256(str);
}

/**
 * Canonicalize event data for deterministic hashing.
 * Keys sorted alphabetically, no whitespace.
 */
export function canonicalizeEventData(data) {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return data; }
  }
  if (data === null || data === undefined) return '';
  const sorted = Object.keys(data).sort();
  const obj = {};
  for (const k of sorted) obj[k] = data[k];
  return JSON.stringify(obj);
}

/**
 * Generate a magic link token (64 hex chars) with its hash.
 */
export async function generateMagicLinkToken() {
  const token = generateToken(32);
  const hash = await sha256(token);
  return { token, hash };
}

/**
 * Hash contract HTML for integrity verification.
 * Canonicalize: collapse whitespace, trim, NFC normalize.
 */
export async function hashContractHTML(html) {
  const canonical = String(html).normalize('NFC').replace(/\s+/g, ' ').trim();
  return sha256(canonical);
}

/**
 * Mask an email for display: j***@example.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***@***.***';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';
  const masked = local[0] + '***';
  return masked + '@' + domain;
}
