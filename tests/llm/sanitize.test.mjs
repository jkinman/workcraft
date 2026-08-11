import { pass, fail } from '../helpers.mjs';
import {
  assertUsageRecordSafe,
  sanitizeMetadataForLedger,
  sanitizeProviderError,
  sanitizeValueForLedger,
} from '../../lib/llm/sanitize.mjs';
import { buildRouteAuditFromRecords, buildObservabilityReport } from '../../lib/llm/observability.mjs';
import { createUsageRecord } from '../../lib/llm/usage-record.mjs';

console.log('\nllm sanitize + route audit tests');

try {
  const nested = sanitizeMetadataForLedger({
    tenantId: 'tenant-a',
    nested: {
      prompt: 'secret prompt text',
      api_key: 'sk-live-abc1234567890',
      messages: [{ role: 'user', content: 'hello' }],
      safeField: 'ok',
    },
    responseBody: '{"error":{"message":"Bearer sk-bad"}}',
  });

  if (nested.nested.prompt === '[redacted]' && nested.nested.api_key === '[redacted]') {
    pass('sanitizeMetadataForLedger redacts nested forbidden keys');
  } else {
    fail(`nested redaction failed: ${JSON.stringify(nested)}`);
  }

  try {
    assertUsageRecordSafe({
      task: 'evaluation',
      metadata: { nested: { authorization: 'Bearer sk-secret' } },
    });
    fail('assertUsageRecordSafe should reject nested authorization');
  } catch (err) {
    if (/forbidden key/i.test(err.message)) pass('assertUsageRecordSafe rejects nested forbidden keys');
    else fail(`unexpected nested assert error: ${err.message}`);
  }

  const safeError = sanitizeProviderError(new Error('upstream failed: api_key=sk-abcdef1234567890'));
  if (!/sk-/.test(safeError)) pass('sanitizeProviderError redacts secret-like API errors');
  else fail(`provider error not redacted: ${safeError}`);

  const route = {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    spendTier: 'standard',
    adapterId: 'gemini',
    capabilities: [],
    budgetCeilingUsd: null,
    fallbacks: [],
    endpoint: { baseUrl: 'https://hidden.example', host: 'hidden.example', apiKey: 'secret' },
  };

  const record = createUsageRecord({
    task: 'evaluation',
    route,
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cached_tokens: 0 },
    estimatedCostUsd: 0.001,
    rateCardVersion: '2026-08-10',
    latencyMs: 100,
    outcome: 'success',
    attempt: 1,
    metadata: sanitizeMetadataForLedger({
      routeAudit: {
        selectedProvider: 'gemini',
        selectedModel: 'gemini-2.5-flash',
        spendTier: 'standard',
        routeIndex: 0,
        fallbackCount: 1,
        routesAvailable: 2,
        budgetBlocked: false,
      },
    }),
  });

  assertUsageRecordSafe(record);
  const audit = buildRouteAuditFromRecords([record]);
  if (audit.length === 1 && audit[0].fallbackCount === 1 && !JSON.stringify(audit).includes('hidden.example')) {
    pass('buildRouteAuditFromRecords rebuilds historical audit without credentials');
  } else {
    fail(`route audit from records failed: ${JSON.stringify(audit)}`);
  }

  const report = buildObservabilityReport({ records: [record], tenantId: 'tenant-a' });
  if (report.routeAuditSource === 'usage-records' && report.routeAudit.length === 1) {
    pass('buildObservabilityReport prefers persisted route audit from usage records');
  } else {
    fail('observability report missing route audit from records');
  }
} catch (e) {
  fail(`sanitize/route audit tests crashed: ${e.message}`);
}
