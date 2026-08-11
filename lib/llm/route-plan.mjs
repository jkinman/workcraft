/**
 * Execution route plan — flatten fallbacks, explicit override rules, budget filtering.
 */

import { BudgetBlockedError } from './failure-policy.mjs';

/** @typedef {'allow' | 'block' | 'assume-max'} UnknownPricingPolicy */

/**
 * @param {import('./types.mjs').ResolvedModelRoute} primary
 * @returns {import('./types.mjs').ResolvedModelRoute[]}
 */
export function flattenRouteChain(primary) {
  const chain = [primary];
  for (const fb of primary.fallbacks ?? []) {
    chain.push({ ...fb, fallbacks: [] });
  }
  return chain;
}

/**
 * Explicit provider/model overrides disable cross-provider fallback unless opt-in.
 *
 * @param {import('./types.mjs').ResolvedModelRoute} primary
 * @param {import('./types.mjs').RouteHints} [hints]
 */
export function buildExecutionRoutePlan(primary, hints = {}) {
  const chain = flattenRouteChain(primary);
  const explicitOverride = Boolean(hints.provider) || Boolean(hints.model);
  const allowCrossProviderFallback = hints.allowCrossProviderFallback === true;

  if (explicitOverride && !allowCrossProviderFallback) {
    return {
      routes: [chain[0]],
      explicitOverride: true,
      allowCrossProviderFallback: false,
    };
  }

  return {
    routes: chain,
    explicitOverride,
    allowCrossProviderFallback,
  };
}

/**
 * @param {import('./types.mjs').ResolvedModelRoute[]} routes
 * @param {object} params
 * @param {number|null|undefined} params.ceiling
 * @param {(route: import('./types.mjs').ResolvedModelRoute) => number|null} params.estimateForRoute
 * @param {UnknownPricingPolicy} [params.unknownPricingPolicy]
 */
export function filterRoutesForBudget(routes, { ceiling, estimateForRoute, unknownPricingPolicy = 'allow' }) {
  if (ceiling == null) return routes;

  const viable = [];
  for (const route of routes) {
    const estimate = estimateForRoute(route);
    if (estimate == null) {
      if (unknownPricingPolicy === 'allow') viable.push(route);
      continue;
    }
    if (estimate <= ceiling) viable.push(route);
  }
  return viable;
}

/**
 * Hard pre-call budget gate. Throws BudgetBlockedError when no route may run.
 *
 * @param {import('./types.mjs').ResolvedModelRoute[]} routes
 * @param {object} params
 * @param {number|null|undefined} params.ceiling
 * @param {(route: import('./types.mjs').ResolvedModelRoute) => number|null} params.estimateForRoute
 * @param {UnknownPricingPolicy} [params.unknownPricingPolicy]
 * @returns {import('./types.mjs').ResolvedModelRoute[]}
 */
export function enforceBudgetBeforeCall(routes, { ceiling, estimateForRoute, unknownPricingPolicy = 'allow' }) {
  if (ceiling == null) return routes;

  const estimates = routes.map((route) => ({
    route,
    estimate: estimateForRoute(route),
  }));

  const viable = filterRoutesForBudget(routes, { ceiling, estimateForRoute, unknownPricingPolicy });
  if (viable.length > 0) return viable;

  const priced = estimates.filter((e) => e.estimate != null);
  const allPricedExceed = priced.length > 0 && priced.every((e) => e.estimate > ceiling);
  const allUnknown = estimates.every((e) => e.estimate == null);

  let reason = 'no_route_within_budget';
  if (allUnknown && unknownPricingPolicy === 'block') reason = 'unknown_pricing_blocked';
  else if (allUnknown && unknownPricingPolicy === 'assume-max') reason = 'unknown_pricing_assumed_over_ceiling';
  else if (allPricedExceed) reason = 'all_priced_routes_exceed_ceiling';

  throw new BudgetBlockedError(
    `Every route exceeds budget ceiling $${ceiling} (policy=${unknownPricingPolicy})`,
    { ceiling, unknownPricingPolicy, reason, routeCount: routes.length, estimates },
  );
}
