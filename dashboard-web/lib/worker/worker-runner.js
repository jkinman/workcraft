/**
 * Resilient background worker runner — lease enforcement, retry, heartbeat, shutdown.
 */

const { executeJob } = require('./job-executor');

const DEFAULT_HEARTBEAT_MS = 15_000;

function computeBackoffSeconds(retryCount, baseSeconds = 30) {
  return baseSeconds * Math.max(1, retryCount);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LeaseLostError extends Error {
  constructor(message = 'Worker lost lease for job') {
    super(message);
    this.name = 'LeaseLostError';
  }
}

/**
 * @param {object} job
 * @param {WorkerRunOptions} options
 */
async function processJob(job, options) {
  const log = options.log ?? console.log;
  const execute = options.executeJobFn ?? executeJob;
  const jobAbortController = new AbortController();
  const jobSignal = options.jobSignal ?? jobAbortController.signal;

  log(`[worker] claimed ${job.jobType} job ${job.jobId} for tenant ${job.tenantId}`);

  let heartbeatTimer;
  let leaseLost = false;

  const abortForLeaseLoss = (reason = 'lease lost') => {
    if (leaseLost) return;
    leaseLost = true;
    log(`[worker] lease lost for ${job.jobId}: ${reason}`);
    jobAbortController.abort(new LeaseLostError(reason));
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  };

  try {
    heartbeatTimer = setInterval(async () => {
      try {
        const renewed = await options.jobsRepository.renewLease(job.jobId, options.workerId);
        if (!renewed) {
          abortForLeaseLoss('renewLease returned false');
          return;
        }
        await options.jobsRepository.heartbeat(options.workerId, {
          jobId: job.jobId,
          jobType: job.jobType,
          tenantId: job.tenantId,
        });
      } catch (err) {
        log(`[worker] heartbeat failed for ${job.jobId}: ${err.message}`);
        abortForLeaseLoss(err.message);
      }
    }, options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);

    const result = await execute(job, {
      client: options.supabaseClient,
      signal: jobSignal,
    });

    if (leaseLost || jobSignal.aborted) {
      return { processed: true, outcome: 'lease_lost', error: jobSignal.reason?.message || 'lease lost' };
    }

    if (result?.success === false) {
      const failed = await options.jobsRepository.fail(
        job.jobId,
        options.workerId,
        result.error || 'Job returned unsuccessful result',
        computeBackoffSeconds(job.retryCount + 1),
      );
      log(`[worker] failed ${job.jobId}: ${result.error || 'unknown error'} status=${failed.status}`);
      return { processed: true, outcome: failed.status };
    }

    const completed = await options.jobsRepository.complete(job.jobId, options.workerId, result || {});
    log(`[worker] completed ${job.jobId}`);
    return { processed: true, outcome: completed.status, result: completed.result };
  } catch (error) {
    if (leaseLost || error?.name === 'LeaseLostError' || jobSignal.aborted) {
      return { processed: true, outcome: 'lease_lost', error: error.message };
    }

    try {
      const failed = await options.jobsRepository.fail(
        job.jobId,
        options.workerId,
        error.message,
        computeBackoffSeconds(job.retryCount + 1),
      );
      log(`[worker] failed ${job.jobId}: ${error.message} status=${failed.status}`);
      return { processed: true, outcome: failed.status, error: error.message };
    } catch (failError) {
      log(`[worker] could not mark ${job.jobId} failed: ${failError.message}`);
      return { processed: true, outcome: 'lease_lost', error: error.message };
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

async function runWorkerLoop(options) {
  const log = options.log ?? console.log;
  let shuttingDown = false;

  const onShutdown = () => {
    shuttingDown = true;
    log('[worker] graceful shutdown requested');
  };

  if (options.signal) {
    if (options.signal.aborted) shuttingDown = true;
    options.signal.addEventListener('abort', onShutdown, { once: true });
  }

  await options.jobsRepository.heartbeat(options.workerId, { status: 'starting' });

  do {
    if (shuttingDown) break;

    const job = await options.jobsRepository.claimNext(options.workerId, options.staleSeconds);
    if (!job) {
      if (options.once) break;
      await sleep(options.pollIntervalMs ?? 5000);
      continue;
    }

    await processJob(job, options);
    if (options.once) break;
  } while (!shuttingDown);

  await options.jobsRepository.heartbeat(options.workerId, { status: shuttingDown ? 'stopped' : 'idle' });
  return { workerId: options.workerId, graceful: shuttingDown };
}

module.exports = {
  LeaseLostError,
  computeBackoffSeconds,
  processJob,
  runWorkerLoop,
  DEFAULT_HEARTBEAT_MS,
};
