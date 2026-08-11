import { pass, fail } from '../helpers.mjs';
import {
  estimateUsageCostSync,
  getRateCardVersion,
  loadRateCard,
  resetRateCardCache,
} from '../../lib/llm/rate-card.mjs';
import { estimateCost, normalizeOpenAIUsage, RATES } from '../../utils/token-tracker.mjs';

console.log('\nllm rate-card & token-tracker delegation tests');

try {
  resetRateCardCache();
  const card = loadRateCard();
  if (getRateCardVersion(card) === card.version) {
    pass('loadRateCard exposes versioned static data');
  } else {
    fail('rate card version mismatch');
  }

  const usage = { prompt_tokens: 1000, completion_tokens: 500, cached_tokens: 200, total_tokens: 1500 };
  const cost = estimateUsageCostSync({ model: 'gpt-4o-mini', usage, provider: 'openai' });
  const expected = (800 * RATES['gpt-4o-mini'].input) + (200 * RATES['gpt-4o-mini'].input * 0.5) + (500 * RATES['gpt-4o-mini'].output);
  if (cost !== null && Math.abs(cost - expected) < 1e-12) {
    pass('estimateUsageCostSync applies cached token pricing for OpenAI models');
  } else {
    fail(`cached pricing failed: expected ${expected}, got ${cost}`);
  }

  const geminiUsage = { prompt_tokens: 1000, completion_tokens: 500, cached_tokens: 400, total_tokens: 1500 };
  const geminiCost = estimateUsageCostSync({ model: 'gemini-2.5-flash', usage: geminiUsage, provider: 'gemini' });
  const geminiRate = card.models['gemini-2.5-flash'];
  const geminiExpected = (600 * geminiRate.input) + (400 * geminiRate.cachedInput) + (500 * geminiRate.output);
  if (geminiCost !== null && Math.abs(geminiCost - geminiExpected) < 1e-12) {
    pass('estimateUsageCostSync uses cachedInput rate for Gemini models');
  } else {
    fail(`gemini cached pricing failed: expected ${geminiExpected}, got ${geminiCost}`);
  }

  const delegated = estimateCost('gpt-4o-mini', { prompt_tokens: 1000, completion_tokens: 500, cached_tokens: 0 }, 'openai');
  if (delegated !== null && Math.abs(delegated - 0.00045) < 1e-9) {
    pass('utils/token-tracker estimateCost delegates to lib/llm rate card');
  } else {
    fail(`delegated estimateCost failed: ${delegated}`);
  }

  const normalized = normalizeOpenAIUsage({
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    prompt_tokens_details: { cached_tokens: 3 },
  });
  if (normalized.cached_tokens === 3) {
    pass('utils/token-tracker normalizeOpenAIUsage delegates to gateway normalizer');
  } else {
    fail('normalizeOpenAIUsage delegation failed');
  }

  const unknown = estimateUsageCostSync({
    model: 'unknown-model',
    usage,
    provider: 'unknown-provider',
  });
  if (unknown === null) {
    pass('unknown model/provider returns null cost');
  } else {
    fail(`expected null cost, got ${live}`);
  }
} catch (e) {
  fail(`rate-card tests crashed: ${e.message}`);
}
