const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const CONFIG = require('../../config');
const { createDataClient } = require('../data/career-ops-data-client');
const { SupabaseRepository } = require('../repositories/supabase-repository');
const { createReportService } = require('../services/report-service');
const { createEvaluationService } = require('../services/evaluation-service');
const { runPdf } = require('../services/pdf-service');
const {
  materializeTenantForScan,
  syncScanArtifacts,
  materializeTenantForEvaluation,
  syncEvaluationArtifacts,
} = require('./tenant-materializer');

const execFilePromise = promisify(execFile);

async function createTenantDataClient(tenantId, client) {
  const repository = new SupabaseRepository({ tenantId, client });
  await repository.initialize();
  return createDataClient(repository);
}

async function createTenantReportService(dataClient) {
  const reportsModule = await import('../../../lib/reports/index.mjs');
  return createReportService(dataClient, reportsModule);
}

async function runScanJob(job, { client, careerOpsPath = CONFIG.CAREER_OPS_PATH, signal } = {}) {
  const { mkdtemp, rm } = await import('fs/promises');
  const { tmpdir } = await import('os');
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'career-ops-scan-'));

  try {
    await materializeTenantForScan(job.tenantId, client, tempRoot);

    const args = ['scan.mjs', '--json'];
    if (job.payload?.dryRun) args.push('--dry-run');
    if (job.payload?.deepDive) args.push('--deep-dive');

    const { stdout } = await execFilePromise('node', args, {
      cwd: careerOpsPath,
      timeout: job.payload?.deepDive ? 300_000 : 120_000,
      maxBuffer: 1024 * 1024,
      signal,
      env: {
        ...process.env,
        CAREER_OPS_DATA_ROOT: tempRoot
      }
    });

    if (!job.payload?.dryRun) {
      await syncScanArtifacts(job.tenantId, client, tempRoot);
    }

    const { extractWorkerScanMetrics } = await import('../../../lib/discovery/scan-result.mjs');
    const metrics = extractWorkerScanMetrics(stdout);

    return {
      dryRun: Boolean(job.payload?.dryRun),
      deepDive: Boolean(job.payload?.deepDive),
      metricsSource: metrics.source,
      companies: metrics.companies,
      tasks: metrics.tasks,
      totalFound: metrics.totalFound,
      newOffers: metrics.newOffers,
      elapsedMs: metrics.elapsedMs,
      scanResult: metrics.scanResult,
      output: stdout.slice(-2000)
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runEvaluationJob(job, { client } = {}) {
  const { mkdtemp, rm } = await import('fs/promises');
  const { tmpdir } = await import('os');
  const { LocalCareerOpsRepository } = require('../repositories/local-career-ops-repository');
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'career-ops-eval-'));

  try {
    await materializeTenantForEvaluation(job.tenantId, client, tempRoot);

    const repository = new LocalCareerOpsRepository({ tenantId: 'local-dev', rootPath: tempRoot });
    const dataClient = createDataClient(repository);
    const evaluation = createEvaluationService(dataClient, { mode: 'hosted', tenantId: job.tenantId });
    const result = await evaluation.run(job.payload || {}, {
      useFakeGateway: process.env.CAREER_OPS_EVAL_FAKE === '1',
    });

    if (result.success) {
      await syncEvaluationArtifacts(job.tenantId, client, tempRoot);
    }

    return result;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runPdfJob(job, { client } = {}) {
  const dataClient = await createTenantDataClient(job.tenantId, client);
  const reports = await createTenantReportService(dataClient);
  return runPdf(job.payload || {}, { dataClient, reports });
}

async function executeJob(job, deps = {}) {
  if (!job) return null;

  if (job.jobType === 'scan') {
    return runScanJob(job, deps);
  }

  if (job.jobType === 'pdf') {
    return runPdfJob(job, deps);
  }

  if (job.jobType === 'evaluation') {
    return runEvaluationJob(job, deps);
  }

  throw new Error(`Unsupported job type: ${job.jobType}`);
}

module.exports = {
  createTenantDataClient,
  executeJob,
  runEvaluationJob,
  runPdfJob,
  runScanJob
};
