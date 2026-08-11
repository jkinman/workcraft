import { pass, fail } from '../helpers.mjs';
import { createGateway } from '../../lib/llm/gateway.mjs';
import { createFakeAdapter } from '../../lib/llm/adapters/fake.mjs';
import { TELEMETRY } from '../../lib/llm/telemetry.mjs';

console.log('\nllm gateway integration tests');

try {
  let callCount = 0;
  const fake = createFakeAdapter(async () => {
    callCount += 1;
    if (callCount < 2) {
      const err = new Error('rate limited');
      err.status = 429;
      throw err;
    }
    return {
      text: 'gateway-ok',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cached_tokens: 10 },
    };
  });

  const gateway = createGateway({
    adapters: { 'openai-compatible': fake, gemini: fake },
  });

  const result = await gateway.complete({
    task: 'evaluation',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'user' },
    ],
    route: { provider: 'openai-compatible', model: 'gpt-4o-mini' },
    retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5 },
  });

  if (result.text === 'gateway-ok' && result.attempts === 2) {
    pass('createGateway retries through injectable adapter and returns normalized result');
  } else {
    fail(`gateway retry result unexpected: ${JSON.stringify(result)} callCount=${callCount}`);
  }

  if (gateway.ledger.length === 1 && gateway.ledger.readAll()[0].cachedTokens === 10) {
    pass('gateway appends Usage Record to injectable ledger');
  } else {
    fail('ledger not updated');
  }

  const telemetryTypes = gateway.telemetry.events.map((e) => e.type);
  if (telemetryTypes.includes(TELEMETRY.COMPLETE) && telemetryTypes.includes(TELEMETRY.RETRY_SCHEDULED)) {
    pass('gateway emits structured telemetry audit events');
  } else {
    fail(`telemetry missing expected events: ${telemetryTypes.join(',')}`);
  }

  let liveCalled = false;
  const liveGateway = createGateway({
    adapters: { 'openai-compatible': createFakeAdapter(async () => ({ text: 'live', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cached_tokens: 0 } })) },
    livePricingLookup: async () => {
      liveCalled = true;
      return 0.99;
    },
  });
  const liveResult = await liveGateway.complete({
    task: 'triage',
    messages: [{ role: 'user', content: 'hi' }],
    route: { provider: 'openai-compatible' },
  });
  if (liveCalled && liveResult.estimatedCostUsd === 0.99) {
    pass('livePricingLookup hook overrides static rate-card estimate');
  } else {
    fail('live pricing hook failed');
  }

  await import('../../lib/llm/index.mjs');
  pass('lib/llm/index.mjs is import-safe');
} catch (e) {
  fail(`gateway tests crashed: ${e.message}`);
}
