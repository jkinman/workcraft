/**
 * Versioned static rate card + optional live-pricing lookup hook.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CARD_PATH = join(ROOT, 'data', 'rate-card-v1.json');

let cachedCard = null;

/**
 * @param {string} [cardPath]
 * @returns {{ version: string, currency: string, models: Record<string, object>, providerDefaults: Record<string, string|null>, freeProviders: string[], openRouterFreeWhenUnpinned: boolean }}
 */
export function loadRateCard(cardPath = DEFAULT_CARD_PATH) {
  if (!cardPath || cardPath === DEFAULT_CARD_PATH) {
    if (cachedCard) return cachedCard;
    cachedCard = JSON.parse(readFileSync(DEFAULT_CARD_PATH, 'utf8'));
    return cachedCard;
  }
  return JSON.parse(readFileSync(cardPath, 'utf8'));
}

/** @returns {string} */
export function getRateCardVersion(card = loadRateCard()) {
  return card.version;
}

/**
 * Legacy flat map consumed by utils/token-tracker.mjs and batch tooling.
 * @returns {Record<string, { input: number, output: number, cachedInput?: number }>}
 */
export function getLegacyRatesMap(card = loadRateCard()) {
  return { ...card.models };
}

/**
 * @param {string} model
 * @param {Record<string, object>} models
 */
function resolveModelRate(model, models) {
  if (!model) return null;
  if (models[model]) return models[model];
  const key = Object.keys(models).find((k) => model.includes(k));
  return key ? models[key] : null;
}

/**
 * @param {object} params
 * @param {string} params.model
 * @param {import('./types.mjs').NormalizedUsage} params.usage
 * @param {string} [params.provider]
 * @param {Record<string, unknown>} [params.env]
 * @param {object} [params.card]
 * @param {(input: { model: string, provider?: string, usage: import('./types.mjs').NormalizedUsage }) => Promise<number|null|undefined>} [params.liveLookup]
 * @returns {Promise<number|null>|number|null}
 */
export function estimateUsageCost({
  model,
  usage,
  provider,
  env = typeof process !== 'undefined' ? process.env : {},
  card = loadRateCard(),
  liveLookup,
}) {
  if (liveLookup) {
    const live = liveLookup({ model, provider, usage });
    if (live && typeof live.then === 'function') {
      return live.then((value) =>
        value == null ? estimateUsageCostSync({ model, usage, provider, env, card }) : value,
      );
    }
    if (live != null) return live;
  }
  return estimateUsageCostSync({ model, usage, provider, env, card });
}

/**
 * @param {object} params
 * @param {string} params.model
 * @param {import('./types.mjs').NormalizedUsage} params.usage
 * @param {string} [params.provider]
 * @param {Record<string, unknown>} [params.env]
 * @param {object} [params.card]
 * @returns {number|null}
 */
export function estimateUsageCostSync({ model, usage, provider, env = {}, card = loadRateCard() }) {
  if (provider && card.freeProviders.includes(provider)) return 0;
  if (
    provider === 'openrouter' &&
    card.openRouterFreeWhenUnpinned &&
    !env.CAREER_OPS_MODEL
  ) {
    return 0;
  }

  let rate = resolveModelRate(model, card.models);
  if (!rate) {
    const fallbackModel = provider ? card.providerDefaults[provider] : null;
    if (fallbackModel) rate = card.models[fallbackModel] ?? null;
  }
  if (!rate) return null;

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const cached = usage.cached_tokens || 0;
  const promptCost = Math.max(promptTokens - cached, 0) * rate.input;
  const cachedCost = cached * (rate.cachedInput ?? rate.input * 0.5);
  const completionCost = completionTokens * rate.output;
  return promptCost + cachedCost + completionCost;
}

/** Reset in-memory cache — test helper. */
export function resetRateCardCache() {
  cachedCard = null;
}

export const RATE_CARD_VERSION = getRateCardVersion();
