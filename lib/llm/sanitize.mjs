/**
 * Sanitize usage-record metadata — strip prompts, secrets, and unsafe API payloads.
 */

const FORBIDDEN_KEY_EXACT = new Set([
  'apikey', 'api_key', 'secret', 'password', 'authorization', 'bearer',
  'messages', 'prompt', 'systeminstruction', 'usercontent', 'rawprompt',
  'system', 'body', 'responsebody', 'requestbody', 'headers',
]);

const ALLOWED_KEY_EXACT = new Set([
  'prompttokens', 'completiontokens', 'totaltokens', 'cachedtokens',
]);

const FORBIDDEN_KEY_SUBSTR = ['prompt', 'message', 'authorization', 'secret', 'apikey', 'api_key', 'password', 'bearer'];

function isForbiddenKey(key) {
  const norm = String(key).toLowerCase();
  if (ALLOWED_KEY_EXACT.has(norm)) return false;
  if (FORBIDDEN_KEY_EXACT.has(norm)) return true;
  return FORBIDDEN_KEY_SUBSTR.some((part) => {
    if (norm === part) return true;
    if (norm.startsWith(`${part}_`) || norm.endsWith(`_${part}`)) return true;
    if (norm.includes(`_${part}_`)) return true;
    const camel = String(key).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (camel === part || camel.startsWith(`${part}_`) || camel.endsWith(`_${part}`)) return true;
    return camel.includes(`_${part}_`);
  });
}

const SECRET_VALUE_PATTERN = /(?:^Bearer\s|sk-[a-z0-9_-]{8,}|api[_-]?key\s*[:=]|secret\s*[:=])/i;

const MAX_STRING_LEN = 500;
const MAX_DEPTH = 8;

/**
 * @param {unknown} value
 */
function looksLikeSecret(value) {
  if (typeof value !== 'string') return false;
  return SECRET_VALUE_PATTERN.test(value);
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @returns {unknown}
 */
export function sanitizeValueForLedger(value, depth = 0) {
  if (depth > MAX_DEPTH) return '[truncated-depth]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (looksLikeSecret(value)) return '[redacted-secret]';
    return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValueForLedger(item, depth + 1));
  }
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isForbiddenKey(key)) {
        out[key] = '[redacted]';
        continue;
      }
      out[key] = sanitizeValueForLedger(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * @param {Record<string, unknown>|undefined|null} metadata
 * @returns {Record<string, unknown>|undefined}
 */
export function sanitizeMetadataForLedger(metadata) {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const sanitized = sanitizeValueForLedger(metadata, 0);
  return typeof sanitized === 'object' && sanitized && !Array.isArray(sanitized)
    ? Object.freeze({ ...sanitized })
    : undefined;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function sanitizeProviderError(error) {
  const message = String(error?.message ?? error ?? 'unknown error');
  if (looksLikeSecret(message)) return 'provider error (redacted)';
  if (message.length > MAX_STRING_LEN) return `${message.slice(0, MAX_STRING_LEN)}…`;
  return message;
}

/**
 * Build safe route-audit metadata persisted on Usage Records.
 *
 * @param {object} params
 */
export function buildRouteAuditMetadata({
  route,
  routeIndex = 0,
  fallbackCount = 0,
  routesAvailable = 1,
  budgetBlocked = false,
  budgetReason = null,
  budgetCeiling = null,
}) {
  return sanitizeMetadataForLedger({
    routeAudit: {
      selectedProvider: route?.provider ?? null,
      selectedModel: route?.model ?? null,
      spendTier: route?.spendTier ?? null,
      routeIndex,
      fallbackCount,
      routesAvailable,
      budgetBlocked,
      budgetReason,
      budgetCeiling,
    },
  });
}

/**
 * Deep safety check for usage records before export/persistence.
 *
 * @param {unknown} value
 * @param {string} [path]
 */
export function assertUsageRecordSafe(value, path = 'record') {
  if (value == null) return true;
  if (typeof value === 'string') {
    if (looksLikeSecret(value)) {
      throw new Error(`Usage record contains secret-like value at ${path}`);
    }
    return true;
  }
  if (typeof value !== 'object') return true;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertUsageRecordSafe(item, `${path}[${index}]`));
    return true;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (isForbiddenKey(key)) {
      throw new Error(`Usage record contains forbidden key at ${path}.${key}`);
    }
    assertUsageRecordSafe(nested, `${path}.${key}`);
  }
  return true;
}
