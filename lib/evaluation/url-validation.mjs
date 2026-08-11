/**
 * SSRF-safe public URL validation for evaluation job payloads.
 * Reuses discovery liveness host guards; blocks private networks and non-http(s) schemes.
 */

import { rejectPrivateOrInvalid } from '../discovery/liveness/browser.mjs';

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
]);

function normalizeHost(rawHostname) {
  if (!rawHostname) return '';
  let host = String(rawHostname).toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.endsWith('.')) host = host.slice(0, -1);
  return host;
}

function throwForGuard(guard) {
  if (guard.code === 'invalid_url') {
    throw new Error('Invalid URL format');
  }
  if (guard.code === 'unsupported_protocol') {
    throw new Error('Only http(s) job posting URLs are allowed');
  }
  throw new Error('Private or internal URLs are not allowed');
}

/**
 * @param {string} rawUrl
 * @returns {URL}
 */
export function validatePublicJobUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL is required when jdText is not provided');
  }

  const trimmed = rawUrl.trim();
  const guard = rejectPrivateOrInvalid(trimmed);
  if (guard) throwForGuard(guard);

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format');
  }

  const host = normalizeHost(parsed.hostname);
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Private or internal URLs are not allowed');
  }

  return parsed;
}

/**
 * @param {{ url?: string, jdText?: string, notes?: string }} payload
 */
export function validateEvaluationPayload(payload = {}) {
  const jdText = typeof payload.jdText === 'string' ? payload.jdText.trim() : '';
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  const url = typeof payload.url === 'string' ? payload.url.trim() : '';

  if (jdText.length >= 80) {
    return {
      url: url || null,
      jdText,
      notes,
      source: url ? 'url-and-text' : 'text',
    };
  }

  if (!url) {
    throw new Error('Provide a job posting URL or at least 80 characters of JD text');
  }

  const parsed = validatePublicJobUrl(url);
  return {
    url: parsed.href,
    jdText: jdText || null,
    notes,
    source: jdText ? 'url-and-text' : 'url',
  };
}
