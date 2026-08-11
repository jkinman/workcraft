import { pass, fail } from '../helpers.mjs';
import {
  resolveModelRoute,
  parseSpendTierFromProfile,
  normalizeSpendTier,
  DEFAULT_ROUTE_TABLE,
} from '../../lib/llm/routing.mjs';

console.log('\nllm routing tests');

try {
  if (normalizeSpendTier('economy') === 'economy' && normalizeSpendTier('bogus') === 'standard') {
    pass('normalizeSpendTier accepts economy and falls back invalid values to standard');
  } else {
    fail('normalizeSpendTier failed');
  }

  const profile = 'name: Test\nspend_tier: premium\n';
  if (parseSpendTierFromProfile(profile) === 'premium') {
    pass('parseSpendTierFromProfile reads spend_tier from profile.yml text');
  } else {
    fail('parseSpendTierFromProfile failed');
  }

  const openaiRoute = resolveModelRoute({
    hints: { provider: 'openai-compatible', spendTier: 'standard' },
    env: { OPENAI_BASE_URL: 'https://api.openai.com/v1', OPENAI_API_KEY: 'sk-test' },
  });
  if (openaiRoute.adapterId === 'openai-compatible' && openaiRoute.model === DEFAULT_ROUTE_TABLE.standard['openai-compatible'].model) {
    pass('resolveModelRoute picks openai-compatible standard tier model');
  } else {
    fail(`openai standard route unexpected: ${JSON.stringify(openaiRoute)}`);
  }

  const overrideRoute = resolveModelRoute({
    hints: { provider: 'openai-compatible', model: 'deepseek/deepseek-chat', spendTier: 'economy' },
    env: { OPENAI_BASE_URL: 'https://openrouter.ai/api/v1' },
  });
  if (overrideRoute.model === 'deepseek/deepseek-chat' && overrideRoute.provider === 'openrouter') {
    pass('resolveModelRoute honors explicit model override and detects openrouter host');
  } else {
    fail(`override route unexpected: ${JSON.stringify(overrideRoute)}`);
  }

  const geminiRoute = resolveModelRoute({
    hints: { provider: 'gemini', spendTier: 'premium' },
    env: { GEMINI_API_KEY: 'g-test' },
  });
  if (geminiRoute.adapterId === 'gemini' && geminiRoute.model === DEFAULT_ROUTE_TABLE.premium.gemini.model) {
    pass('resolveModelRoute resolves gemini premium tier');
  } else {
    fail(`gemini route unexpected: ${JSON.stringify(geminiRoute)}`);
  }

  if ((geminiRoute.fallbacks ?? []).length > 0) {
    pass('resolveModelRoute attaches fallback routes');
  } else {
    fail('expected fallback routes on primary route');
  }

  const budgetRoute = resolveModelRoute({
    hints: { provider: 'openai-compatible', spendTier: 'standard', budgetCeilingUsd: 0.01 },
  });
  if (budgetRoute.budgetCeilingUsd === 0.01) {
    pass('resolveModelRoute carries budget ceiling from hints');
  } else {
    fail('budget ceiling not propagated');
  }
} catch (e) {
  fail(`routing tests crashed: ${e.message}`);
}
