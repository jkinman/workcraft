import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('LLM observability service', () => {
  it('summarizes usage by tenant/task/provider/model with budget alerts', async () => {
    const { buildTenantObservabilityReport } = await import('../lib/services/llm-observability-service');
    const { LocalCareerOpsRepository } = await import('../lib/repositories/local-career-ops-repository');
    const { createDataClient } = await import('../lib/data/career-ops-data-client');

    const root = mkdtempSync(join(tmpdir(), 'co-obs-svc-'));
    mkdirSync(join(root, 'data'), { recursive: true });
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(join(root, 'config/profile.yml'), 'llm_budget_soft_usd: 0.001\nllm_budget_hard_usd: 0.01\n');
    writeFileSync(join(root, 'data/llm-usage.jsonl'), [
      JSON.stringify({
        id: 'r1', timestamp: new Date().toISOString(), task: 'evaluation', provider: 'openai-compatible',
        model: 'gpt-4o-mini', spendTier: 'standard', promptTokens: 100, completionTokens: 50,
        totalTokens: 150, estimatedCostUsd: 0.002, rateCardVersion: '2026-08-10', latencyMs: 200,
        outcome: 'success', attempt: 1, metadata: { tenantId: 'tenant-a' },
      }),
      JSON.stringify({
        id: 'r2', timestamp: new Date().toISOString(), task: 'evaluation', provider: 'gemini',
        model: 'gemini-2.5-flash', spendTier: 'standard', promptTokens: 80, completionTokens: 40,
        totalTokens: 120, estimatedCostUsd: 0.001, rateCardVersion: '2026-01-01', latencyMs: 150,
        outcome: 'error', attempt: 2, metadata: { tenantId: 'tenant-a' },
      }),
    ].join('\n'));

    const repo = new LocalCareerOpsRepository({ tenantId: 'local-dev', rootPath: root });
    const dataClient = createDataClient(repo);
    const report = await buildTenantObservabilityReport(dataClient, { tenantId: 'tenant-a' });

    expect(report.summaries.length).toBeGreaterThanOrEqual(2);
    expect(report.metrics.count).toBe(2);
    expect(report.budgetAlerts.some((a) => a.level === 'soft')).toBe(true);
    expect(report.rateCardWarnings.some((w) => w.type === 'stale_rate_card')).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/apiKey|"prompt"|"messages"/i);
  });

  it('builds route audit trail from persisted usage record metadata', async () => {
    const { buildTenantObservabilityReport } = await import('../lib/services/llm-observability-service');
    const { LocalCareerOpsRepository } = await import('../lib/repositories/local-career-ops-repository');
    const { createDataClient } = await import('../lib/data/career-ops-data-client');
    const { sanitizeMetadataForLedger } = await import('../../lib/llm/sanitize.mjs');

    const root = mkdtempSync(join(tmpdir(), 'co-route-audit-'));
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'data/llm-usage.jsonl'), JSON.stringify({
      id: 'r1',
      timestamp: new Date().toISOString(),
      task: 'evaluation',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      spendTier: 'standard',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
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
          routeIndex: 1,
          fallbackCount: 1,
          routesAvailable: 2,
          budgetBlocked: false,
        },
      }),
    }));

    const repo = new LocalCareerOpsRepository({ tenantId: 'local-dev', rootPath: root });
    const dataClient = createDataClient(repo);
    const report = await buildTenantObservabilityReport(dataClient, { tenantId: 'local-dev' });
    expect(report.routeAuditSource).toBe('usage-records');
    expect(report.routeAudit.length).toBe(1);
    expect(report.routeAudit[0].fallbackCount).toBe(1);
    expect(JSON.stringify(report.routeAudit)).not.toMatch(/apiKey|Bearer|prompt/i);
  });
});

describe('LLM observability module (root lib)', () => {
  it('builds route audit trail from telemetry events', async () => {
    const { buildRouteAuditTrail, assertUsageRecordSafe } = await import('../../lib/llm/observability.mjs');
    const { TELEMETRY } = await import('../../lib/llm/telemetry.mjs');

    const trail = buildRouteAuditTrail([
      { type: TELEMETRY.ROUTE_RESOLVED, timestamp: 't1', data: { provider: 'gemini', model: 'gemini-2.5-flash' } },
      { type: TELEMETRY.ROUTE_FALLBACK, timestamp: 't2', data: { provider: 'openai-compatible', model: 'gpt-4o-mini', reason: '429' } },
      { type: 'prompt.assembled', timestamp: 't3', data: { prompt: 'SECRET' } },
    ]);

    expect(trail.length).toBe(2);
    expect(trail[0].provider).toBe('gemini');
    expect(JSON.stringify(trail)).not.toContain('SECRET');

    expect(() => assertUsageRecordSafe({ task: 'x', apiKey: 'leak' })).toThrow(/forbidden key/);
  });
});
