import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createCareerOpsServices } from '../lib/services/dashboard-service';
import { createHostedWorkloadRunner } from '../lib/services/workload-runner';
import { executeJob, runEvaluationJob } from '../lib/worker/job-executor';
import { materializeTenantForEvaluation, syncEvaluationArtifacts } from '../lib/worker/tenant-materializer';

function makeFakeJobsRepository() {
  const jobs = new Map();
  let seq = 0;
  return {
    jobs,
    async enqueue(tenantId, jobType, payload) {
      const jobId = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
      const job = { jobId, tenantId, jobType, status: 'queued', payload, pollUrl: `/api/jobs/${jobId}` };
      jobs.set(jobId, job);
      return job;
    },
  };
}

function makeFakeTenantClient(documents) {
  return {
    from(table) {
      if (table !== 'tenant_documents') throw new Error(`Unexpected table: ${table}`);
      return {
        select() {
          return {
            eq(_column, tenantId) {
              const rows = documents.filter(row => row.tenant_id === tenantId);
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
        upsert(row) {
          const index = documents.findIndex(doc => doc.tenant_id === row.tenant_id && doc.path === row.path);
          if (index === -1) documents.push(row);
          else documents[index] = row;
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

describe('evaluation workload', () => {
  it('runs inline locally with fake gateway and persists a report', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'co-eval-local-'));
    process.env.CAREER_OPS_PATH = rootPath;
    process.env.CAREER_OPS_TENANT_MODE = 'local-dev';
    process.env.CAREER_OPS_EVAL_FAKE = '1';

    mkdirSync(join(rootPath, 'config'), { recursive: true });
    mkdirSync(join(rootPath, 'data'), { recursive: true });
    writeFileSync(join(rootPath, 'cv.md'), '# Candidate\n## Engineer\n');
    writeFileSync(join(rootPath, 'config/profile.yml'), 'spend_tier: standard\n');
    writeFileSync(join(rootPath, 'data/applications.md'), [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-------|',
      '',
    ].join('\n'));

    const services = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'local-dev' });
    const result = await services.runner.runEvaluation({
      jdText: 'A'.repeat(80),
      notes: 'contract test',
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('local-inline');
    expect(result.status).toBe('completed');
    expect(result.company).toBe('Acme Corp');
    expect(existsSync(join(rootPath, 'reports'))).toBe(true);
  });

  it('queues hosted evaluation jobs with tenant-scoped payloads', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'tenant-a', mode: 'hosted' }, jobsRepository);

    const queued = await runner.enqueueEvaluation({
      url: 'https://boards.greenhouse.io/acme/jobs/123',
      jdText: 'B'.repeat(80),
    });

    expect(queued).toMatchObject({
      mode: 'hosted-job',
      jobType: 'evaluation',
      status: 'queued',
    });
    expect([...jobsRepository.jobs.values()][0].payload.url).toContain('greenhouse.io');
  });

  it('executes hosted evaluation jobs with fake worker gateway and syncs artifacts', async () => {
    process.env.CAREER_OPS_EVAL_FAKE = '1';
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-worker-'));
    const documents = [
      {
        tenant_id: 'tenant-a',
        path: 'cv.md',
        content: '# Candidate\n## Engineer\n',
      },
      {
        tenant_id: 'tenant-a',
        path: 'config/profile.yml',
        content: 'spend_tier: standard\n',
      },
      {
        tenant_id: 'tenant-a',
        path: 'data/applications.md',
        content: [
          '# Applications Tracker',
          '',
          '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
          '|---|------|---------|------|-------|--------|-----|--------|-------|',
          '',
        ].join('\n'),
      },
    ];
    const client = makeFakeTenantClient(documents);

    const result = await runEvaluationJob({
      tenantId: 'tenant-a',
      jobType: 'evaluation',
      payload: { jdText: 'C'.repeat(80) },
    }, { client });

    expect(result.success).toBe(true);
    expect(documents.some(doc => doc.path.startsWith('reports/'))).toBe(true);
  });

  it('reads URL-only postings through fake browser before evaluating', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'co-eval-url-'));
    process.env.CAREER_OPS_PATH = rootPath;
    process.env.CAREER_OPS_TENANT_MODE = 'local-dev';
    process.env.CAREER_OPS_EVAL_FAKE = '1';

    mkdirSync(join(rootPath, 'config'), { recursive: true });
    mkdirSync(join(rootPath, 'data'), { recursive: true });
    writeFileSync(join(rootPath, 'cv.md'), '# Candidate\n## Engineer\n');
    writeFileSync(join(rootPath, 'config/profile.yml'), 'spend_tier: standard\n');
    writeFileSync(join(rootPath, 'data/applications.md'), [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-------|',
      '',
    ].join('\n'));

    const jdBody = `Staff Engineer\n\n${'Ship reliable systems. '.repeat(30)}`;
    const page = {
      url: () => 'https://boards.greenhouse.io/acme/jobs/123',
      _routeInterceptorRegistered: false,
      _blockedByGuard: null,
      async goto() { return { status: () => 200 }; },
      async waitForTimeout() {},
      async evaluate(fn) {
        const source = fn.toString();
        if (source.includes('querySelectorAll')) return ['Apply'];
        return jdBody;
      },
    };

    const services = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'local-dev' });
    const result = await services.evaluation.run({
      url: 'https://boards.greenhouse.io/acme/jobs/123',
    }, {
      useFakeGateway: true,
      postingReaderOptions: {
        browser: { async close() {} },
        page,
      },
    });

    expect(result.success).toBe(true);
    expect(result.company).toBe('Acme Corp');
  });

  it('rejects unsupported worker job types', async () => {
    await expect(executeJob({ jobType: 'unknown' })).rejects.toThrow('Unsupported job type');
  });
});
