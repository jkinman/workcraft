/**
 * Retry and timeout helpers for LLM HTTP adapters.
 */

/** @typedef {{ maxAttempts?: number, initialDelayMs?: number, maxDelayMs?: number, backoffMultiplier?: number, retryableStatuses?: number[], retryableErrorNames?: string[] }} RetryPolicy */

export const DEFAULT_RETRY_POLICY = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 409, 429, 500, 502, 503, 504],
  retryableErrorNames: ['TimeoutError', 'AbortError'],
};

export const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * @param {Partial<RetryPolicy>} [overrides]
 * @returns {Required<RetryPolicy>}
 */
export function mergeRetryPolicy(overrides = {}) {
  return { ...DEFAULT_RETRY_POLICY, ...overrides };
}

/**
 * @param {number} attempt 1-based
 * @param {Required<RetryPolicy>} policy
 */
export function retryDelayMs(attempt, policy) {
  const delay = policy.initialDelayMs * policy.backoffMultiplier ** (attempt - 1);
  return Math.min(delay, policy.maxDelayMs);
}

/**
 * @param {unknown} error
 * @param {number|null|undefined} status
 * @param {Required<RetryPolicy>} policy
 */
export function isRetryableError(error, status, policy) {
  if (status != null && policy.retryableStatuses.includes(status)) return true;
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  return policy.retryableErrorNames.includes(name);
}

/**
 * @template T
 * @param {object} params
 * @param {() => Promise<T>} params.run
 * @param {Partial<RetryPolicy>} [params.policy]
 * @param {(ctx: { attempt: number, error: unknown, status?: number, delayMs: number }) => void} [params.onRetry]
 * @returns {Promise<{ result: T, attempts: number }>}
 */
export async function withRetries({ run, policy: policyOverrides, onRetry }) {
  const policy = mergeRetryPolicy(policyOverrides);
  let lastError;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const result = await run();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : undefined;
      const retryable = attempt < policy.maxAttempts && isRetryableError(error, status, policy);
      if (!retryable) break;
      const delayMs = retryDelayMs(attempt, policy);
      onRetry?.({ attempt, error, status, delayMs });
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/**
 * @param {number} timeoutMs
 * @param {typeof AbortSignal} [AbortSignalImpl]
 */
export function createTimeoutSignal(timeoutMs, AbortSignalImpl = globalThis.AbortSignal) {
  if (!AbortSignalImpl?.timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    return controller.signal;
  }
  return AbortSignalImpl.timeout(timeoutMs);
}

/**
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP error with status for retry classification.
 */
export class HttpResponseError extends Error {
  /**
   * @param {number} status
   * @param {string} body
   */
  constructor(status, body) {
    super(`HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = 'HttpResponseError';
    this.status = status;
    this.body = body;
  }
}
