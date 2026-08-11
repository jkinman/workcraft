import { pass, fail } from '../helpers.mjs';
import { createGateway } from '../../lib/llm/gateway.mjs';
import { createFakeAdapter } from '../../lib/llm/adapters/fake.mjs';
import { HttpResponseError } from '../../lib/llm/retry.mjs';
import { BudgetBlockedError } from '../../lib/llm/failure-policy.mjs';
import { TELEMETRY } from '../../lib/llm/telemetry.mjs';

console.log('\nllm gateway runtime fallback tests');

try {
  // Runtime fallback: primary 503 → secondary succeeds
  let openaiCalls = 0;
  let geminiCalls = 0;
  const gateway = createGateway({
    adapters: {
      'openai-compatible': createFakeAdapter(async () => {
        openaiCalls += 1;
        throw new HttpResponseError(503, 'upstream down');
      }),
      gemini: createFakeAdapter(async () => {
        geminiCalls += 1;
        return { text: 'from-gemini', usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7, cached_tokens: 1 } };
      }, 'gemini'),
    },
  });

  const fbResult = await gateway.complete({
    task: 'evaluation',
    messages: [{ role: 'user', content: 'hi' }],
    route: { provider: 'openai-compatible', spendTier: 'standard', allowCrossProviderFallback: true },
    retry: { maxAttempts: 1, initialDelayMs: 1 },
  });

  if (fbResult.text === 'from-gemini' && openaiCalls === 1 && geminiCalls === 1) {
    pass('gateway falls back to next route after retryable provider failure');
  } else {
    fail(`fallback result unexpected: text=${fbResult.text} openai=${openaiCalls} gemini=${geminiCalls}`);
  }

  if (fbResult.route.adapterId === 'gemini' && gateway.ledger.readAll().at(-1).provider === 'gemini') {
    pass('success Usage Record reflects actually executed fallback route');
  } else {
    fail('usage record route mismatch after fallback');
  }

  const fbEvents = gateway.telemetry.eventsOfType(TELEMETRY.ROUTE_FALLBACK);
  if (fbEvents.length === 1 && fbEvents[0].data.toAdapterId === 'gemini') {
    pass('telemetry emits route.fallback audit event');
  } else {
    fail('missing route.fallback telemetry');
  }

  // No fallback on 401 auth error
  const authGateway = createGateway({
    adapters: {
      'openai-compatible': createFakeAdapter(async () => {
        throw new HttpResponseError(401, 'invalid key');
      }),
      gemini: createFakeAdapter(async () => ({ text: 'should-not-run' }), 'gemini'),
    },
  });

  try {
    await authGateway.complete({
      task: 'evaluation',
      messages: [{ role: 'user', content: 'hi' }],
      route: { provider: 'openai-compatible', allowCrossProviderFallback: true },
      retry: { maxAttempts: 1, initialDelayMs: 1 },
    });
    fail('expected 401 to throw without fallback');
  } catch (err) {
    if (err.status === 401 && authGateway.telemetry.eventsOfType(TELEMETRY.ROUTE_FALLBACK).length === 0) {
      pass('401 auth errors do not trigger cross-provider fallback');
    } else {
      fail(`401 fallback behavior wrong: ${err.message}`);
    }
  }

  if (authGateway.ledger.length === 1 && authGateway.ledger.readAll()[0].provider !== 'gemini') {
    pass('failure Usage Record reflects primary route when fallback skipped');
  } else {
    fail('auth failure record used wrong route');
  }

  // Explicit override: no fallback without opt-in
  let explicitGeminiCalls = 0;
  const explicitGateway = createGateway({
    adapters: {
      'openai-compatible': createFakeAdapter(async () => {
        throw new HttpResponseError(503, 'down');
      }),
      gemini: createFakeAdapter(async () => {
        explicitGeminiCalls += 1;
        return { text: 'nope' };
      }, 'gemini'),
    },
  });

  try {
    await explicitGateway.complete({
      task: 'evaluation',
      messages: [{ role: 'user', content: 'hi' }],
      route: { provider: 'openai-compatible', model: 'gpt-4o-mini' },
      retry: { maxAttempts: 1, initialDelayMs: 1 },
    });
    fail('expected throw without opt-in fallback');
  } catch {
    if (explicitGeminiCalls === 0) {
      pass('explicit provider/model override skips fallback unless allowCrossProviderFallback');
    } else {
      fail('gemini should not run for explicit override without opt-in');
    }
  }

  // Pre-call budget block
  const budgetGateway = createGateway({
    adapters: {
      'openai-compatible': createFakeAdapter(async () => ({ text: 'should-not-run' })),
      gemini: createFakeAdapter(async () => ({ text: 'also-no' }), 'gemini'),
    },
  });

  try {
    await budgetGateway.complete({
      task: 'evaluation',
      messages: [{ role: 'user', content: 'hi' }],
      route: {
        provider: 'openai-compatible',
        spendTier: 'premium',
        budgetCeilingUsd: 0.000001,
        unknownPricingPolicy: 'block',
        allowCrossProviderFallback: true,
      },
    });
    fail('expected pre-call budget block');
  } catch (err) {
    if (err instanceof BudgetBlockedError) {
      pass('hard budget ceiling blocks before any adapter invocation');
    } else {
      fail(`expected BudgetBlockedError, got ${err.message}`);
    }
  }

  if (
    budgetGateway.telemetry.eventsOfType(TELEMETRY.BUDGET_BLOCKED).some((e) => e.data.preCall === true) &&
    budgetGateway.ledger.readAll()[0].metadata?.routeAudit?.budgetBlocked === true
  ) {
    pass('pre-call budget block emits telemetry and records budget-blocked outcome');
  } else {
    fail('budget block audit trail incomplete');
  }

  // Per-route retries then fallback
  let retryOpenai = 0;
  const retryGateway = createGateway({
    adapters: {
      'openai-compatible': createFakeAdapter(async () => {
        retryOpenai += 1;
        throw new HttpResponseError(429, 'rate limited');
      }),
      gemini: createFakeAdapter(async () => ({ text: 'after-retries' }), 'gemini'),
    },
  });

  const retryResult = await retryGateway.complete({
    task: 'evaluation',
    messages: [{ role: 'user', content: 'hi' }],
    route: { provider: 'openai-compatible', allowCrossProviderFallback: true },
    retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 2 },
  });

  if (retryOpenai === 2 && retryResult.text === 'after-retries' && retryResult.attempts === 1) {
    pass('per-route retries exhaust before advancing to next fallback route');
  } else {
    fail(`per-route retry/fallback failed: openaiCalls=${retryOpenai} result=${JSON.stringify(retryResult)}`);
  }
} catch (e) {
  fail(`gateway fallback tests crashed: ${e.message}`);
}
