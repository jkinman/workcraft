/**
 * Default spend-tier → provider/model route table for scripted evaluators.
 * Modes/_shared.md remains scoring truth; this table is execution routing only.
 */

/** @type {Record<import('./types.mjs').SpendTier, Record<import('./types.mjs').AdapterId, { model: string }>>} */
export const DEFAULT_ROUTE_TABLE = {
  economy: {
    'openai-compatible': { model: 'gpt-4o-mini' },
    gemini: { model: 'gemini-2.5-flash' },
  },
  standard: {
    'openai-compatible': { model: 'gpt-4o-mini' },
    gemini: { model: 'gemini-3.6-flash' },
  },
  premium: {
    'openai-compatible': { model: 'gpt-4o' },
    gemini: { model: 'gemini-2.5-pro' },
  },
};

/** @type {import('./types.mjs').AdapterId[]} */
export const DEFAULT_FALLBACK_ORDER = ['openai-compatible', 'gemini'];

/**
 * @param {string|undefined|null} value
 * @returns {import('./types.mjs').SpendTier}
 */
export function normalizeSpendTier(value) {
  if (value === 'economy' || value === 'premium') return value;
  return 'standard';
}

/**
 * Parse spend_tier from profile.yml text without a YAML dependency.
 * @param {string} [profileYml]
 * @returns {import('./types.mjs').SpendTier}
 */
export function parseSpendTierFromProfile(profileYml = '') {
  const match = profileYml.match(/^spend_tier:\s*(\S+)/m);
  return normalizeSpendTier(match?.[1]?.replace(/['"]/g, ''));
}

/**
 * Infer adapter from environment when not explicitly set.
 * @param {Record<string, unknown>} [env]
 * @returns {import('./types.mjs').AdapterId}
 */
export function inferAdapterFromEnv(env = {}) {
  if (env.GEMINI_API_KEY && !env.OPENAI_API_KEY && !env.OPENAI_BASE_URL) {
    return 'gemini';
  }
  return 'openai-compatible';
}

/**
 * @param {URL|string} baseUrl
 */
export function hostFromBaseUrl(baseUrl) {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return String(baseUrl).replace(/^https?:\/\//, '').split('/')[0];
  }
}

/**
 * @param {object} params
 * @param {import('./types.mjs').RouteHints} [params.hints]
 * @param {string} [params.profileYml]
 * @param {Record<string, unknown>} [params.env]
 * @param {typeof DEFAULT_ROUTE_TABLE} [params.routeTable]
 * @param {import('./types.mjs').AdapterId[]} [params.fallbackOrder]
 * @returns {import('./types.mjs').ResolvedModelRoute}
 */
export function resolveModelRoute({
  hints = {},
  profileYml = '',
  env = typeof process !== 'undefined' ? process.env : {},
  routeTable = DEFAULT_ROUTE_TABLE,
  fallbackOrder = DEFAULT_FALLBACK_ORDER,
}) {
  const spendTier = normalizeSpendTier(hints.spendTier ?? parseSpendTierFromProfile(profileYml));
  const adapterId = hints.provider ?? inferAdapterFromEnv(env);
  const tierRoutes = routeTable[spendTier] ?? routeTable.standard;
  const tierEntry = tierRoutes[adapterId] ?? tierRoutes['openai-compatible'];
  const model = hints.model ?? env.OPENAI_MODEL ?? env.GEMINI_MODEL ?? tierEntry.model;

  const route = buildRouteForAdapter({
    adapterId,
    model,
    spendTier,
    hints,
    env,
    capabilities: hints.capabilities ?? ['chat'],
    budgetCeilingUsd: hints.budgetCeilingUsd ?? null,
  });

  const fallbacks = fallbackOrder
    .filter((id) => id !== adapterId)
    .map((id) => {
      const fbModel = tierRoutes[id]?.model;
      if (!fbModel) return null;
      return buildRouteForAdapter({
        adapterId: id,
        model: fbModel,
        spendTier,
        hints,
        env,
        capabilities: hints.capabilities ?? ['chat'],
        budgetCeilingUsd: hints.budgetCeilingUsd ?? null,
      });
    })
    .filter(Boolean);

  return { ...route, fallbacks };
}

/**
 * @param {object} params
 * @returns {import('./types.mjs').ResolvedModelRoute}
 */
function buildRouteForAdapter({
  adapterId,
  model,
  spendTier,
  hints,
  env,
  capabilities,
  budgetCeilingUsd,
}) {
  if (adapterId === 'gemini') {
    return {
      adapterId,
      provider: 'gemini',
      model,
      spendTier,
      capabilities,
      budgetCeilingUsd,
      fallbacks: [],
      endpoint: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        host: 'generativelanguage.googleapis.com',
        apiKey: hints.apiKey ?? env.GEMINI_API_KEY ?? '',
        apiKeyEnv: 'GEMINI_API_KEY',
      },
    };
  }

  const baseUrl = (hints.baseUrl ?? env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const host = hostFromBaseUrl(baseUrl);
  const provider =
    host.includes('openrouter.ai') ? 'openrouter'
      : host.includes('ollama') || host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'ollama'
        : host === 'api.openai.com' ? 'openai'
          : 'openai-compatible';

  return {
    adapterId: 'openai-compatible',
    provider,
    model,
    spendTier,
    capabilities,
    budgetCeilingUsd,
    fallbacks: [],
    endpoint: {
      baseUrl,
      host,
      apiKey: hints.apiKey ?? env.OPENAI_API_KEY ?? '',
      apiKeyEnv: 'OPENAI_API_KEY',
    },
  };
}

/**
 * Pick the first route whose estimated cost fits the budget ceiling.
 * @param {import('./types.mjs').ResolvedModelRoute} primary
 * @param {(route: import('./types.mjs').ResolvedModelRoute) => number|null} estimateForRoute
 */
export function selectRouteWithinBudget(primary, estimateForRoute) {
  const candidates = [primary, ...(primary.fallbacks ?? [])];
  for (const route of candidates) {
    const estimate = estimateForRoute(route);
    if (route.budgetCeilingUsd == null || estimate == null || estimate <= route.budgetCeilingUsd) {
      return route;
    }
  }
  return primary;
}
