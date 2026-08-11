#!/usr/bin/env node

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createWorkerBackgroundJobsRepository } = require('../lib/repositories/background-jobs-repository');
const { createSupabaseServerClient, requireSupabaseConfig } = require('../lib/repositories/supabase-client');
const { runWorkerLoop } = require('../lib/worker/worker-runner');

function parseArgs(argv) {
  return {
    once: argv.includes('--once'),
    pollIntervalMs: Number.parseInt(getArgValue(argv, '--interval') || process.env.WORKER_POLL_INTERVAL_MS || '5000', 10),
    staleSeconds: Number.parseInt(process.env.WORKER_STALE_SECONDS || '900', 10),
    heartbeatMs: Number.parseInt(process.env.WORKER_HEARTBEAT_MS || '15000', 10),
    workerId: process.env.WORKER_ID || `worker-${process.pid}`,
  };
}

function getArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] || null;
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
  const jobsRepository = createWorkerBackgroundJobsRepository(process.env);

  console.log(`[worker] starting id=${options.workerId} once=${options.once} interval=${options.pollIntervalMs}ms`);

  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => controller.abort());
  }

  await runWorkerLoop({
    workerId: options.workerId,
    jobsRepository,
    supabaseClient: client,
    once: options.once,
    pollIntervalMs: options.pollIntervalMs,
    staleSeconds: options.staleSeconds,
    heartbeatMs: options.heartbeatMs,
    signal: controller.signal,
  });
}

main().catch((error) => {
  console.error('[worker] fatal error:', error);
  process.exit(1);
});
