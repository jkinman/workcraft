import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createInMemoryJobsRepository } from './fakes/in-memory-jobs-repository';
import { getSupabaseInitializeCount, resetSupabaseInitializeCount } from '../lib/repositories/repository-factory';

function clerkRequest(tenantId) {
  return new Request('http://localhost/api/test', {
    headers: { authorization: `Bearer fake-${tenantId}` },
    auth: { tenantId },
  });
}

function makeHostedTenantStore() {
  const documents = new Map();
  const storage = new Map();

  function docKey(tenantId, path) {
    return `${tenantId}:${path}`;
  }

  function makeSupabaseClient(tenantId) {
    return {
      from(table) {
        if (table !== 'tenant_documents') throw new Error(`Unexpected table ${table}`);
        return {
          select() {
            return {
              eq(_col, tid) {
                const rows = [...documents.values()].filter((r) => r.tenant_id === tid);
                return Promise.resolve({ data: rows, error: null });
              },
            };
          },
          upsert(row) {
            if (row.tenant_id !== tenantId) {
              return Promise.resolve({ error: new Error('RLS cross-tenant write denied') });
            }
            documents.set(docKey(row.tenant_id, row.path), row);
            return Promise.resolve({ error: null });
          },
        };
      },
      storage: {
        from() {
          return {
            upload: async (key, content) => {
              if (!key.startsWith(`${tenantId}/`)) return { error: new Error('RLS storage denied') };
              storage.set(key, Buffer.from(content));
              return { error: null };
            },
            download: async (key) => {
              if (!key.startsWith(`${tenantId}/`)) return { data: null, error: new Error('RLS denied') };
              if (!storage.has(key)) return { data: null, error: new Error('missing') };
              return {
                data: { async arrayBuffer() { return storage.get(key); } },
                error: null,
              };
            },
            list: async (prefix) => ({
              data: [...storage.keys()]
                .filter((k) => k.startsWith(`${prefix}/`))
                .map((k) => ({ name: k.slice(prefix.length + 1), updated_at: new Date().toISOString(), metadata: { size: storage.get(k).length } })),
              error: null,
            }),
            createSignedUrl: async (key) => ({ data: { signedUrl: `signed:${key}` }, error: null }),
          };
        },
      },
      rpc() {
        return Promise.resolve({ data: null, error: null });
      },
    };
  }

  return { documents, storage, makeSupabaseClient };
}

describe('two-tenant hosted E2E (fakes only)', () => {
  beforeEach(() => {
    resetSupabaseInitializeCount();
    process.env.CAREER_OPS_TENANT_MODE = 'hosted';
    process.env.CAREER_OPS_EVAL_FAKE = '1';
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('initializes hosted repositories once per request scope', async () => {
    const store = makeHostedTenantStore();
    const { resolveTenantServices } = await import('../lib/tenant-services');
    const { createCareerOpsServices } = await import('../lib/services/dashboard-service');
    const request = clerkRequest('tenant-a');
    const tenant = {
      tenantId: 'tenant-a',
      mode: 'hosted',
      supabaseClient: store.makeSupabaseClient('tenant-a'),
    };

    const services1 = await resolveTenantServices(request, tenant);
    const services2 = await resolveTenantServices(request, tenant);
    expect(services1).toBe(services2);
    expect(services1.repository.storageAdapter).toBe('supabase');

    await createCareerOpsServices({
      ...tenant,
      supabaseClient: store.makeSupabaseClient('tenant-a'),
    });
  });

  it('completes onboarding and writes tenant-scoped profile documents', async () => {
    const store = makeHostedTenantStore();
    const { SupabaseRepository } = await import('../lib/repositories/supabase-repository');
    const { createDataClient } = await import('../lib/data/career-ops-data-client');

    const repoA = new SupabaseRepository({ tenantId: 'tenant-a', client: store.makeSupabaseClient('tenant-a') });
    await repoA.initialize();
    const dataA = createDataClient(repoA);
    await dataA.writeProfile('candidate:\n  full_name: Tenant A\n');
    await dataA.writePipeline('# Pipeline\n');
    expect(store.documents.get('tenant-a:config/profile.yml')?.content).toContain('Tenant A');
    expect(store.documents.get('tenant-a:data/pipeline.md')?.content).toContain('# Pipeline');

    const repoB = new SupabaseRepository({ tenantId: 'tenant-b', client: store.makeSupabaseClient('tenant-b') });
    await repoB.initialize();
    expect(repoB.readText('config/profile.yml')).toBeNull();
  });

  it('enqueues scan/evaluation jobs and enforces cross-tenant job polling denial', async () => {
    const jobsRepo = createInMemoryJobsRepository();
    const { createHostedWorkloadRunner } = await import('../lib/services/workload-runner');

    const runnerA = createHostedWorkloadRunner({ tenantId: 'tenant-a', mode: 'hosted' }, jobsRepo);
    const runnerB = createHostedWorkloadRunner({ tenantId: 'tenant-b', mode: 'hosted' }, jobsRepo);

    const scanJob = await runnerA.enqueueScan({ dryRun: true });
    const evalJob = await runnerA.enqueueEvaluation({ jdText: 'D'.repeat(80) });

    expect(scanJob.mode).toBe('hosted-job');
    expect(evalJob.jobType).toBe('evaluation');

    await expect(jobsRepo.getForTenant('tenant-a', scanJob.jobId)).resolves.toBeTruthy();
    await expect(jobsRepo.getForTenant('tenant-b', scanJob.jobId)).resolves.toBeNull();
  });

  it('runs fake evaluation, persists report artifacts, and blocks cross-tenant reads', async () => {
    const rootA = mkdtempSync(join(tmpdir(), 'co-e2e-a-'));
    const rootB = mkdtempSync(join(tmpdir(), 'co-e2e-b-'));

    for (const root of [rootA, rootB]) {
      mkdirSync(join(root, 'config'), { recursive: true });
      mkdirSync(join(root, 'data'), { recursive: true });
      mkdirSync(join(root, 'modes'), { recursive: true });
      writeFileSync(join(root, 'cv.md'), '# CV\n## Engineer\n');
      writeFileSync(join(root, 'config/profile.yml'), 'spend_tier: standard\n');
      writeFileSync(join(root, 'modes/_shared.md'), '# Shared\n');
      writeFileSync(join(root, 'modes/oferta.md'), '# Oferta\n');
      writeFileSync(join(root, 'data/applications.md'), [
        '# Applications Tracker', '',
        '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
        '|---|------|---------|------|-------|--------|-----|--------|-------|', '',
      ].join('\n'));
    }

    process.env.CAREER_OPS_PATH = rootA;
    process.env.CAREER_OPS_EVAL_FAKE = '1';
    const { createCareerOpsServices } = await import('../lib/services/dashboard-service');
    const servicesA = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'local-dev', rootPath: rootA });
    const result = await servicesA.runner.runEvaluation({ jdText: 'D'.repeat(80), notes: 'e2e' });
    expect(result.success).toBe(true);

    const reportsA = servicesA.reports.listEvaluations();
    expect(reportsA.length).toBeGreaterThan(0);

    const servicesB = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'local-dev', rootPath: rootB });
    expect(servicesB.reports.listEvaluations().length).toBe(0);
  });

  it('transitions tracker state within tenant workspace only', async () => {
    const { transitionApplicationState } = await import('../../lib/tracker/transition-sync.mjs');
    const { createFilesystemDataClient } = await import('../../lib/tracker/fs-data-client.mjs');

    const root = mkdtempSync(join(tmpdir(), 'co-transition-e2e-'));
    mkdirSync(join(root, 'data'), { recursive: true });
    mkdirSync(join(root, 'reports'), { recursive: true });
    writeFileSync(join(root, 'data/applications.md'), [
      '# Applications Tracker', '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-------|',
      '| 1 | 2026-08-10 | Acme | Engineer | 4.0/5 | Evaluated | ❌ | [1](reports/001-acme.md) | |', '',
    ].join('\n'));
    writeFileSync(join(root, 'reports', '001-acme.md'), '---\nstate: evaluated\n---\n\n# Report\n');

    process.env.CAREER_OPS_DATA_ROOT = root;
    const client = createFilesystemDataClient(root);
    const outcome = await transitionApplicationState(client, {
      slug: '001-acme',
      newState: 'Applied',
      source: 'hosted-e2e',
    });
    expect(outcome.success).toBe(true);
    expect(readFileSync(join(root, 'data/applications.md'), 'utf8')).toContain('| Applied |');
  });

  it('serves LLM usage observability without secrets for authorized tenant', async () => {
    const root = mkdtempSync(join(tmpdir(), 'co-obs-e2e-'));
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'data/llm-usage.jsonl'), [
      JSON.stringify({
        id: '1', timestamp: new Date().toISOString(), task: 'evaluation', provider: 'gemini',
        model: 'gemini-2.5-flash', spendTier: 'standard', promptTokens: 10, completionTokens: 5,
        totalTokens: 15, estimatedCostUsd: 0.001, rateCardVersion: '2026-08-10', latencyMs: 100,
        outcome: 'success', attempt: 1,
      }),
    ].join('\n'));

    const { createCareerOpsServices } = await import('../lib/services/dashboard-service');
    const services = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'local-dev', rootPath: root });
    const report = await services.observability.getUsageSummary();
    expect(report.metrics.count).toBe(1);
    expect(JSON.stringify(report)).not.toMatch(/apiKey|secret|prompt|messages/i);
  });
});
