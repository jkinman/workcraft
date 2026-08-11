import { pass, fail } from '../helpers.mjs';
import {
  summarizeUsageRecords,
  computeUsageMetrics,
  evaluateBudgetAlerts,
  checkRateCardWarnings,
  buildObservabilityReport,
  assertUsageRecordSafe,
} from '../../lib/llm/observability.mjs';
import { createUsageRecord } from '../../lib/llm/usage-record.mjs';

console.log('\nllm observability module tests');

try {
  const baseRecord = createUsageRecord({
    task: 'evaluation',
    route: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      spendTier: 'standard',
      capabilities: [],
      budgetCeilingUsd: null,
      fallbacks: [],
      adapterId: 'gemini',
      endpoint: { baseUrl: 'https://x', host: 'x', apiKey: 'hidden' },
    },
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cached_tokens: 0 },
    estimatedCostUsd: 0.001,
    rateCardVersion: '2026-08-10',
    latencyMs: 100,
    outcome: 'success',
    attempt: 1,
  });

  assertUsageRecordSafe(baseRecord);
  pass('assertUsageRecordSafe accepts canonical usage records');

  const summaries = summarizeUsageRecords([baseRecord, { ...baseRecord, id: '2', outcome: 'error' }]);
  if (summaries.length === 1 && summaries[0].count === 2 && summaries[0].errors === 1) {
    pass('summarizeUsageRecords groups by task/provider/model');
  } else {
    fail('summarizeUsageRecords grouping failed');
  }

  const metrics = computeUsageMetrics([baseRecord]);
  if (metrics.count === 1 && metrics.successes === 1) pass('computeUsageMetrics aggregates cost/latency');
  else fail('computeUsageMetrics failed');

  const budget = evaluateBudgetAlerts([baseRecord], { hardLimitUsd: 0.0005 });
  if (budget.blocked && budget.alerts[0].level === 'hard') pass('evaluateBudgetAlerts hard limit blocks');
  else fail('hard budget alert failed');

  const warnings = checkRateCardWarnings([{ ...baseRecord, rateCardVersion: '2020-01-01' }]);
  if (warnings.some((w) => w.type === 'stale_rate_card')) pass('checkRateCardWarnings flags stale rate card versions');
  else fail('stale rate card warning missing');

  const report = buildObservabilityReport({ records: [baseRecord], budgetLimits: { softLimitUsd: 0.0001 } });
  if (report.summaries.length === 1 && !JSON.stringify(report).includes('hidden')) {
    pass('buildObservabilityReport is tenant-safe (no secrets)');
  } else {
    fail('observability report leaked secrets');
  }
} catch (e) {
  fail(`observability tests crashed: ${e.message}`);
}
