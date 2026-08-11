import { describe, expect, it, vi, beforeAll } from 'vitest';

describe('workload runner', () => {
  let createHostedWorkloadRunner;
  let createLocalWorkloadRunner;
  let parseMetric;

  beforeAll(async () => {
    const runnerMod = await import('../lib/services/workload-runner.js');
    createHostedWorkloadRunner = runnerMod.createHostedWorkloadRunner;
    createLocalWorkloadRunner = runnerMod.createLocalWorkloadRunner;
    parseMetric = runnerMod.parseMetric;
  });

  function makeFakeJobsRepository() {
    const jobs = new Map();
    let seq = 0;

    return {
      async enqueue(tenantId, jobType, payload) {
        const jobId = `job-${++seq}`;
        const job = {
          jobId,
          tenantId,
          jobType,
          status: 'queued',
          payload,
          pollUrl: `/api/jobs/${jobId}`
        };
        jobs.set(jobId, job);
        return job;
      }
    };
  }

  it('parses legacy scan metrics behind the local adapter seam', () => {
    expect(parseMetric('Companies scanned: 12\nNew offers added: 3', /Companies scanned:\s+(\d+)/)).toBe(12);
  });

  it('queues scan work in hosted mode with persisted job ids', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'user_123', mode: 'hosted' }, jobsRepository);

    await expect(runner.runScan({ dryRun: true })).resolves.toMatchObject({
      mode: 'hosted-job',
      status: 'queued',
      jobType: 'scan',
      jobId: 'job-1',
      pollUrl: '/api/jobs/job-1'
    });
  });

  it('queues PDF work in hosted mode with persisted job ids', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'user_123', mode: 'hosted' }, jobsRepository);

    await expect(runner.enqueuePdf({ kind: 'resume', company: 'Acme', role: 'Engineer' })).resolves.toMatchObject({
      mode: 'hosted-job',
      status: 'queued',
      jobType: 'pdf',
      jobId: 'job-1',
      pollUrl: '/api/jobs/job-1'
    });
  });

  it('queues evaluation work in hosted mode', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'user_123', mode: 'hosted' }, jobsRepository);

    await expect(runner.enqueueEvaluation({ jdText: 'D'.repeat(80) })).resolves.toMatchObject({
      mode: 'hosted-job',
      status: 'queued',
      jobType: 'evaluation',
      jobId: 'job-1',
      pollUrl: '/api/jobs/job-1'
    });
  });

  it('executes every local pdf kind inline through enqueuePdf', async () => {
    const evaluationService = { run: vi.fn() };
    const reportService = { getBySlug: vi.fn() };
    const dataClient = { tenantRoot: () => '/tmp/tenant' };
    const runner = createLocalWorkloadRunner(dataClient, evaluationService, reportService);

    const result = await runner.enqueuePdf({ kind: 'resume', company: 'Acme', role: 'Engineer' });

    expect(result).toMatchObject({
      mode: 'local-inline',
      jobType: 'pdf',
    });
    expect(result.status).not.toBe('inline-required');
    expect(['completed', 'failed']).toContain(result.status);
    expect(result.result).toBeDefined();
  });
});

describe('evaluation model routing', () => {
  it('delegates to lib/llm rate-card models instead of stale dashboard defaults', async () => {
    const { resolveEvaluationModelRoute } = await import('../lib/llm-bridge.js');
    const economyGemini = await resolveEvaluationModelRoute({
      profileYml: 'spend_tier: economy\n',
      env: { GEMINI_API_KEY: 'test-key' },
    });
    expect(economyGemini.model).toBe('gemini-2.5-flash');
    expect(economyGemini.model).not.toBe('gemini-2.0-flash');
    expect(economyGemini.spendTier).toBe('economy');

    const premiumOpenAi = await resolveEvaluationModelRoute({
      profileYml: 'spend_tier: premium\n',
      env: { OPENAI_API_KEY: 'test-key' },
    });
    expect(premiumOpenAi.model).toBe('gpt-4o');
    expect(premiumOpenAi.spendTier).toBe('premium');
  });
});

describe('evaluation usage records', () => {
  it('persists usage records to tenant data/llm-usage.jsonl during fake evaluation', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');

    const rootPath = mkdtempSync(join(tmpdir(), 'co-usage-ledger-'));
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

    const { createCareerOpsServices } = await import('../lib/services/dashboard-service.js');
    const services = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'local-dev' });
    await services.runner.runEvaluation({ jdText: 'D'.repeat(80), notes: 'usage ledger test' });

    const ledgerPath = join(rootPath, 'data', 'llm-usage.jsonl');
    expect(existsSync(ledgerPath)).toBe(true);
    const records = readFileSync(ledgerPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].model).toBeTruthy();
    expect(JSON.stringify(records[0])).not.toMatch(/apiKey|secret|GEMINI_API_KEY|OPENAI_API_KEY/i);
  });
});
