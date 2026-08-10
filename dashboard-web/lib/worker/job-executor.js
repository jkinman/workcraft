const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const CONFIG = require('../../config');
const { createDataClient } = require('../data/career-ops-data-client');
const { SupabaseRepository } = require('../repositories/supabase-repository');
const { createReportService } = require('../services/report-service');
const { parseMetric } = require('../services/workload-runner');
const pdfBundle = require('../../pdf-bundle-generator');
const {
  materializeTenantForScan,
  syncScanArtifacts
} = require('./tenant-materializer');

const execFilePromise = promisify(execFile);

async function createTenantDataClient(tenantId, client) {
  const repository = new SupabaseRepository({ tenantId, client });
  await repository.initialize();
  return createDataClient(repository);
}

async function runScanJob(job, { client, careerOpsPath = CONFIG.CAREER_OPS_PATH } = {}) {
  const { mkdtemp, rm } = await import('fs/promises');
  const { tmpdir } = await import('os');
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'career-ops-scan-'));

  try {
    await materializeTenantForScan(job.tenantId, client, tempRoot);

    const args = ['scan.mjs'];
    if (job.payload?.dryRun) args.push('--dry-run');
    if (job.payload?.deepDive) args.push('--deep-dive');

    const { stdout } = await execFilePromise('node', args, {
      cwd: careerOpsPath,
      timeout: job.payload?.deepDive ? 300_000 : 120_000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        CAREER_OPS_DATA_ROOT: tempRoot
      }
    });

    if (!job.payload?.dryRun) {
      await syncScanArtifacts(job.tenantId, client, tempRoot);
    }

    return {
      dryRun: Boolean(job.payload?.dryRun),
      deepDive: Boolean(job.payload?.deepDive),
      companies: parseMetric(stdout, /Companies scanned:\s+(\d+)/),
      tasks: parseMetric(stdout, /Tasks run:\s+(\d+)/),
      totalFound: parseMetric(stdout, /Total jobs found:\s+(\d+)/),
      newOffers: parseMetric(stdout, /New offers added:\s+(\d+)/),
      output: stdout.slice(-2000)
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runPdfJob(job, { client } = {}) {
  const dataClient = await createTenantDataClient(job.tenantId, client);
  const reports = createReportService(dataClient);
  const payload = job.payload || {};
  const kind = payload.kind;

  switch (kind) {
    case 'resume':
      return pdfBundle.generateResumePDF(
        payload.company,
        payload.role,
        payload.jobDescription || '',
        { dataClient }
      );
    case 'cover-letter':
      return pdfBundle.generateCoverLetterPDF(
        payload.company,
        payload.role,
        payload.jobDescription || '',
        { dataClient }
      );
    case 'eval-report': {
      const slug = payload.slug;
      const jobMeta = reports.getBySlug(slug);
      if (!jobMeta) throw new Error(`Job evaluation not found: ${slug}`);
      return pdfBundle.generateEvalReportPDF(jobMeta, reports.getRawContent(slug), { dataClient });
    }
    case 'full-eval': {
      const slug = payload.slug;
      const jobMeta = reports.getBySlug(slug);
      if (!jobMeta) throw new Error(`Job evaluation not found: ${slug}`);
      return pdfBundle.generateFullEvalReportPDF(jobMeta, reports.getRawContent(slug), { dataClient });
    }
    default:
      throw new Error(`Unsupported PDF job kind: ${kind || 'unknown'}`);
  }
}

async function executeJob(job, deps = {}) {
  if (!job) return null;

  if (job.jobType === 'scan') {
    return runScanJob(job, deps);
  }

  if (job.jobType === 'pdf') {
    return runPdfJob(job, deps);
  }

  throw new Error(`Unsupported job type: ${job.jobType}`);
}

module.exports = {
  createTenantDataClient,
  executeJob,
  runPdfJob,
  runScanJob
};
