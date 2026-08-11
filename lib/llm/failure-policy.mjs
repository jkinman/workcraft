/**
 * Route failure classification — which errors may trigger runtime fallback.
 */

import { HttpResponseError } from './retry.mjs';

/** HTTP statuses that indicate caller/auth/config problems — never fallback. */
export const NON_FALLBACK_STATUSES = new Set([400, 401, 403, 404, 422]);

/** HTTP statuses that indicate transient/provider issues — fallback after retries exhaust. */
export const FALLBACK_ELIGIBLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

/**
 * @typedef {Object} RouteFailurePolicy
 * @property {Set<number>} [nonFallbackStatuses]
 * @property {Set<number>} [fallbackEligibleStatuses]
 * @property {string[]} [fallbackEligibleErrorNames]
 */

export const DEFAULT_ROUTE_FAILURE_POLICY = {
  nonFallbackStatuses: NON_FALLBACK_STATUSES,
  fallbackEligibleStatuses: FALLBACK_ELIGIBLE_STATUSES,
  fallbackEligibleErrorNames: ['TimeoutError', 'AbortError'],
};

/**
 * @param {unknown} error
 * @returns {number|undefined}
 */
export function getErrorStatus(error) {
  if (error instanceof HttpResponseError) return error.status;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number(error.status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
}

/**
 * @param {unknown} error
 * @param {RouteFailurePolicy} [policy]
 */
export function isFallbackEligibleError(error, policy = DEFAULT_ROUTE_FAILURE_POLICY) {
  const status = getErrorStatus(error);
  if (status != null) {
    if (policy.nonFallbackStatuses.has(status)) return false;
    if (policy.fallbackEligibleStatuses.has(status)) return true;
    // Other 4xx: treat as non-fallback (caller/request issue)
    if (status >= 400 && status < 500) return false;
    if (status >= 500) return true;
  }

  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  return policy.fallbackEligibleErrorNames.includes(name);
}

/**
 * Thrown when every route is blocked by a hard budget ceiling before adapter invocation.
 */
export class BudgetBlockedError extends Error {
  /**
   * @param {string} message
   * @param {object} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'BudgetBlockedError';
    this.details = details;
  }
}
