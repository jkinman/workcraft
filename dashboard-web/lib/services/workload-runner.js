const { createTenantCliRunner } = require('./tenant-cli-runner');

function parseMetric(text, pattern) {
  return parseInt(text.match(pattern)?.[1] || '0', 10);
}

function createLocalWorkloadRunner(dataClient) {
  const cli = createTenantCliRunner(dataClient);

  return {
    ...cli,

    async runScan({ dryRun = false, deepDive = false } = {}) {
      const args = [];
      if (dryRun) args.push('--dry-run');
      if (deepDive) args.push('--deep-dive');

      const { stdout } = await cli.runNodeScript('scan.mjs', args, {
        timeout: deepDive ? 300_000 : 120_000,
        maxBuffer: 1024 * 1024
      });

      return {
        mode: 'local-cli',
        status: 'completed',
        dryRun,
        deepDive,
        companies: parseMetric(stdout, /Companies scanned:\s+(\d+)/),
        tasks: parseMetric(stdout, /Tasks run:\s+(\d+)/),
        totalFound: parseMetric(stdout, /Total jobs found:\s+(\d+)/),
        newOffers: parseMetric(stdout, /New offers added:\s+(\d+)/),
        output: stdout.slice(-2000)
      };
    },

    async enqueuePdf(payload) {
      return {
        mode: 'local-inline',
        status: 'inline-required',
        payload
      };
    }
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
    }
  };
}

function createWorkloadRunner(dataClient, tenantContext = {}, jobsRepository = null) {
  if (tenantContext.mode === 'hosted') {
    return createHostedWorkloadRunner(tenantContext, jobsRepository);
  }

  return createLocalWorkloadRunner(dataClient);
}

module.exports = {
  createHostedWorkloadRunner,
  createLocalWorkloadRunner,
  createWorkloadRunner,
  parseMetric
};
