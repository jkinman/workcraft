#!/usr/bin/env node

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createBackgroundJobsRepository } = require('../lib/repositories/background-jobs-repository');
const { createSupabaseServerClient, requireSupabaseConfig } = require('../lib/repositories/supabase-client');
const { executeJob } = require('../lib/worker/job-executor');

function parseArgs(argv) {
  return {
    once: argv.includes('--once'),
    pollIntervalMs: Number.parseInt(getArgValue(argv, '--interval') || process.env.WORKER_POLL_INTERVAL_MS || '5000', 10),
    staleSeconds: Number.parseInt(process.env.WORKER_STALE_SECONDS || '900', 10),
    workerId: process.env.WORKER_ID || `worker-${process.pid}`
  };
}

function getArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processNextJob(jobsRepository, client, options) {
  const job = await jobsRepository.claimNext(options.workerId, options.staleSeconds);
  if (!job) return false;

  console.log(`[worker] claimed ${job.jobType} job ${job.jobId} for tenant ${job.tenantId}`);

  try {
    const result = await executeJob(job, { client });
    if (result?.success === false) {
      await jobsRepository.fail(job.jobId, options.workerId, result.error || 'Job returned unsuccessful result');
      console.error(`[worker] failed ${job.jobId}: ${result.error || 'unknown error'}`);
      return true;
    }

    await jobsRepository.complete(job.jobId, options.workerId, result || {});
    console.log(`[worker] completed ${job.jobId}`);
  } catch (error) {
    try {
      await jobsRepository.fail(job.jobId, options.workerId, error.message);
    } catch (failError) {
      console.error(`[worker] could not mark ${job.jobId} failed: ${failError.message}`);
    }
    console.error(`[worker] failed ${job.jobId}: ${error.message}`);
  }

  return true;
}

async function main() {
  try {
    requireSupabaseConfig(process.env);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const options = parseArgs(process.argv.slice(2));
  const client = createSupabaseServerClient(process.env);
  const jobsRepository = createBackgroundJobsRepository({ client });

  console.log(`[worker] starting id=${options.workerId} once=${options.once} interval=${options.pollIntervalMs}ms`);

  do {
    const processed = await processNextJob(jobsRepository, client, options);
    if (options.once) break;
    if (!processed) {
      await sleep(options.pollIntervalMs);
    }
  } while (true);
}

main().catch(error => {
  console.error('[worker] fatal error:', error);
  process.exit(1);
});
