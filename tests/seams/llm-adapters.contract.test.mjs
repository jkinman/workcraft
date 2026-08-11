import { pass, fail } from '../helpers.mjs';
import { createGateway } from '../../lib/llm/gateway.mjs';
import { createFakeAdapter } from '../../lib/llm/adapters/fake.mjs';
import {
  assertUsageRecordSafe,
  buildObservabilityReport,
  evaluateBudgetAlerts,
} from '../../lib/llm/observability.mjs';
import { createUsageRecord } from '../../lib/llm/usage-record.mjs';
import { TELEMETRY } from '../../lib/llm/telemetry.mjs';

console.log('\nseam contracts — LLM adapters (failure/timeout/idempotency)');

try {
  // Timeout contract — adapter honors abort signal
  const timeoutAdapter = createFakeAdapter(async (ctx) => {
    await new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('adapter slow')), 500);
      ctx.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      });
    });
    return { text: 'late', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cached_tokens: 0 } };
  });

  const timeoutGateway = createGateway({
    adapters: { 'openai-compatible': timeoutAdapter, gemini: timeoutAdapter },
  });

  let timedOut = false;
  try {
    await timeoutGateway.complete({
      task: 'evaluation',
      messages: [{ role: 'user', content: 'hi' }],
      route: { provider: 'openai-compatible', model: 'gpt-4o-mini' },
      timeoutMs: 25,
      retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2 },
    });
  } catch (err) {
    timedOut = /timeout|aborted|exhausted/i.test(err.message);
  }
  if (timedOut) pass('LLM gateway surfaces adapter timeout as failure');
  else fail('LLM gateway did not fail on adapter timeout');

  // Adapter failure + retry contract on same route
  let attempts = 0;
  const failingThenOk = createFakeAdapter(async () => {
    attempts += 1;
    if (attempts === 1) {
      const err = new Error('upstream 503');
      err.status = 503;
      throw err;
    }
    return {
      text: 'recovered',
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10, cached_tokens: 0 },
    };
  }, 'openai-compatible');

  const retryGateway = createGateway({
    adapters: { 'openai-compatible': failingThenOk, gemini: failingThenOk },
  });

  const recovered = await retryGateway.complete({
    task: 'evaluation',
    messages: [{ role: 'user', content: 'jd' }],
    route: { provider: 'openai-compatible', model: 'gpt-4o-mini' },
    retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2 },
  });

  if (recovered.text === 'recovered') {
    pass('LLM gateway handles adapter failure with retry on same route');
  } else {
    fail(`unexpected recovery text: ${recovered.text}`);
  }

  // Idempotency: duplicate complete calls append one usage record per invocation (ledger is append-only)
  const stableAdapter = createFakeAdapter(async () => ({
    text: 'same',
    usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4, cached_tokens: 0 },
  }));
  const idempotentGateway = createGateway({ adapters: { 'openai-compatible': stableAdapter, gemini: stableAdapter } });
  await idempotentGateway.complete({
    task: 'triage',
    messages: [{ role: 'user', content: 'a' }],
    route: { provider: 'openai-compatible', model: 'gpt-4o-mini' },
    retry: { maxAttempts: 1 },
  });
  await idempotentGateway.complete({
    task: 'triage',
    messages: [{ role: 'user', content: 'a' }],
    route: { provider: 'openai-compatible', model: 'gpt-4o-mini' },
    retry: { maxAttempts: 1 },
  });
  if (idempotentGateway.ledger.length === 2) {
    pass('LLM usage ledger is append-only (duplicate calls produce distinct records)');
  } else {
    fail(`expected 2 ledger records, got ${idempotentGateway.ledger.length}`);
  }

  // Observability safety contract
  const record = createUsageRecord({
    task: 'evaluation',
    route: { provider: 'gemini', model: 'gemini-2.5-flash', spendTier: 'standard', capabilities: [], budgetCeilingUsd: null, fallbacks: [], adapterId: 'gemini', endpoint: { baseUrl: 'x', host: 'x', apiKey: 'secret-should-not-appear' } },
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cached_tokens: 0 },
    estimatedCostUsd: 0.001,
    rateCardVersion: '2026-08-10',
    latencyMs: 120,
    outcome: 'success',
    attempt: 1,
  });
  assertUsageRecordSafe(record);
  if (!JSON.stringify(record).includes('secret-should-not-appear')) {
    pass('Usage records exclude endpoint secrets from serialized form');
  } else {
    fail('Usage record leaked endpoint secret');
  }

  const report = buildObservabilityReport({
    records: [record],
    telemetryEvents: [{ type: TELEMETRY.ROUTE_RESOLVED, timestamp: new Date().toISOString(), data: { provider: 'gemini', model: 'gemini-2.5-flash' } }],
    budgetLimits: { softLimitUsd: 0.0005, hardLimitUsd: 0.01 },
  });
  if (report.summaries.length === 1 && report.budgetAlerts.some((a) => a.level === 'soft')) {
    pass('Observability module emits budget alerts without prompt content');
  } else {
    fail('Observability budget alert contract failed');
  }

  const blocked = evaluateBudgetAlerts(
    [{ ...record, estimatedCostUsd: 0.02 }],
    { hardLimitUsd: 0.01 },
  );
  if (blocked.blocked) pass('Hard budget alert blocks further spend');
  else fail('Hard budget alert did not block');
} catch (e) {
  fail(`LLM seam contract crashed: ${e.message}`);
}
