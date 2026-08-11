/**
 * ESM bridge for dashboard-web (CJS) → lib/llm routing.
 */

let routingModule;

async function loadRouting() {
  if (!routingModule) {
    routingModule = await import('../../lib/llm/routing.mjs');
  }
  return routingModule;
}

/**
 * Resolve evaluation model route from tenant profile and environment.
 *
 * @param {{ profileYml?: string, env?: Record<string, string> }} [options]
 */
async function resolveEvaluationModelRoute(options = {}) {
  const { resolveModelRoute } = await loadRouting();
  return resolveModelRoute({
    profileYml: options.profileYml ?? '',
    env: options.env ?? process.env,
  });
}

module.exports = {
  resolveEvaluationModelRoute,
};
