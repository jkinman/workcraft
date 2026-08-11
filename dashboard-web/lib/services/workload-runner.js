const { createTenantCliRunner } = require('./tenant-cli-runner');
const { runPdf } = require('./pdf-service');

function parseMetric(text, pattern) {
  return parseInt(text.match(pattern)?.[1] || '0', 10);
}

function createLocalWorkloadRunner(dataClient, evaluationService, reportService) {
  const cli = createTenantCliRunner(dataClient);

  return {
    ...cli,

    async runScan({ dryRun = false, deepDive = false } = {}) {
      const args = ['--json'];
      if (dryRun) args.push('--dry-run');
      if (deepDive) args.push('--deep-dive');

      const { stdout } = await cli.runNodeScript('scan.mjs', args, {
        timeout: deepDive ? 300_000 : 120_000,
        maxBuffer: 1024 * 1024
      });

      const { extractWorkerScanMetrics } = await import('../../../lib/discovery/scan-result.mjs');
      const metrics = extractWorkerScanMetrics(stdout);

      return {
        mode: 'local-inline',
        status: 'completed',
        dryRun,
        deepDive,
        metricsSource: metrics.source,
        companies: metrics.companies,
        tasks: metrics.tasks,
        totalFound: metrics.totalFound,
        newOffers: metrics.newOffers,
        elapsedMs: metrics.elapsedMs,
        scanResult: metrics.scanResult,
        output: stdout.slice(-2000)
      };
    },

    async enqueuePdf(payload = {}) {
      const result = await runPdf(payload, { dataClient, reports: reportService });
      return {
        mode: 'local-inline',
        status: result.success ? 'completed' : 'failed',
        jobType: 'pdf',
        result,
        ...(result.success ? {} : { error: result.error }),
      };
    },

    async runPdf(payload = {}) {
      return this.enqueuePdf(payload);
    },

    async enqueueEvaluation(payload, options = {}) {
      const result = await evaluationService.run(payload, options);
      return {
        mode: 'local-inline',
        status: result.success ? 'completed' : 'failed',
        jobType: 'evaluation',
        result,
        ...(result.success ? result : { error: result.error }),
      };
    },

    async runEvaluation(payload, options = {}) {
      return this.enqueueEvaluation(payload, options);
    },
  };
}

function createHostedWorkloadRunner(tenantContext, jobsRepository) {
  if (!jobsRepository) {
    throw new Error('Hosted workload runner requires a BackgroundJobsRepository');
  }

  async function persistJob(jobType, payload) {
    const job = await jobsRepository.enqueue(tenantContext.tenantId, jobType, payload);
    return {
      mode: 'hosted-job',
      jobId: job.jobId,
      status: job.status,
      jobType: job.jobType,
      pollUrl: job.pollUrl
    };
  }

  return {
    async runScan(options = {}) {
      return this.enqueueScan(options);
    },

    async enqueueScan(options = {}) {
      const payload = {
        dryRun: Boolean(options.dryRun),
        deepDive: Boolean(options.deepDive)
      };
      return persistJob('scan', payload);
    },

    async enqueuePdf(payload = {}) {
      return persistJob('pdf', payload);
    },

    async runPdf(payload = {}) {
      return this.enqueuePdf(payload);
    },

    async enqueueEvaluation(payload = {}) {
      return persistJob('evaluation', payload);
    },

    async runEvaluation(payload = {}) {
      return this.enqueueEvaluation(payload);
    },
  };
}

function createWorkloadRunner(dataClient, tenantContext = {}, jobsRepository = null, evaluationService = null, reportService = null) {
  if (tenantContext.mode === 'hosted') {
    return createHostedWorkloadRunner(tenantContext, jobsRepository);
  }

  if (!evaluationService || !reportService) {
    throw new Error('Local workload runner requires evaluation and report services');
  }

  return createLocalWorkloadRunner(dataClient, evaluationService, reportService);
}

module.exports = {
  createHostedWorkloadRunner,
  createLocalWorkloadRunner,
  createWorkloadRunner,
  parseMetric
};
