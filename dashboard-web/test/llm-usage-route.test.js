import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDataClient } from '../lib/data/career-ops-data-client';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import {
  jsonRequest,
  loadRoute,
  mockGetTenantServices,
  stubAuthFailure,
  stubTenantScope,
} from './fakes/route-request-scope';

describe('GET /api/llm-usage', () => {
  beforeEach(() => {
    mockGetTenantServices.mockReset();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.resetModules();
  });

  function makeObservabilityScope(tenantId = 'tenant-a') {
    const root = mkdtempSync(join(tmpdir(), 'co-llm-usage-route-'));
    const tenantRoot = tenantId === 'local-dev'
      ? root
      : join(root, 'tenants', tenantId);
    mkdirSync(join(tenantRoot, 'data'), { recursive: true });
    mkdirSync(join(tenantRoot, 'config'), { recursive: true });
    writeFileSync(join(tenantRoot, 'config/profile.yml'), 'llm_budget_soft_usd: 0.001\nllm_budget_hard_usd: 0.01\n');
    writeFileSync(join(tenantRoot, 'data/llm-usage.jsonl'), [
      JSON.stringify({
        id: 'r1',
        timestamp: new Date().toISOString(),
        task: 'evaluation',
        provider: 'openai-compatible',
        model: 'gpt-4o-mini',
        spendTier: 'standard',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.002,
        rateCardVersion: '2026-08-10',
        latencyMs: 200,
        outcome: 'success',
        attempt: 1,
        metadata: {
          tenantId,
          routeAudit: { selectedProvider: 'openai-compatible', fallbackCount: 0 },
        },
      }),
    ].join('\n'));

    const repo = new LocalCareerOpsRepository({ tenantId, rootPath: root });
    const dataClient = createDataClient(repo);
    return {
      tenant: { tenantId, mode: 'local-dev' },
      services: { dataClient },
      root,
    };
  }

  it('returns a sanitised usage summary for the tenant', async () => {
    const scope = makeObservabilityScope('tenant-a');
    stubTenantScope(scope);

    const { GET } = await loadRoute('../app/api/llm-usage/route.js');
    const response = await GET(jsonRequest('http://localhost/api/llm-usage'));
    const json = await response.json();
    const serialized = JSON.stringify(json);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.metrics.count).toBe(1);
    expect(json.summaries.length).toBeGreaterThanOrEqual(1);
    expect(serialized).not.toMatch(/apiKey|Bearer|"prompt"|"messages"|authorization/i);
  });

  it('returns 500 when observability loading fails', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'local-dev' },
      services: {
        dataClient: {
          repository: {
            dataPath: () => 'data/llm-usage.jsonl',
            exists: () => true,
            readText: () => '{ invalid json',
            profilePath: () => 'config/profile.yml',
          },
        },
      },
    });

    const { GET } = await loadRoute('../app/api/llm-usage/route.js');
    const response = await GET(jsonRequest('http://localhost/api/llm-usage'));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBeTruthy();
  });

  it('translates missing auth/tenant failures into 500 responses', async () => {
    stubAuthFailure('Authentication required for hosted tenant resolution');

    const { GET } = await loadRoute('../app/api/llm-usage/route.js');
    const response = await GET(jsonRequest('http://localhost/api/llm-usage', { tenantId: null }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Authentication required for hosted tenant resolution');
  });
});
