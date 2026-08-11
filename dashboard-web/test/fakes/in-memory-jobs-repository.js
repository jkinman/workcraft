/**
 * In-memory BackgroundJobsRepository for worker/E2E contract tests.
 * Mirrors lease, retry, dead-letter, and idempotency semantics from schema.sql.
 */

const { randomUUID } = require('crypto');
const { normalizeJobRow, DEFAULT_MAX_RETRIES } = require('../../lib/repositories/background-jobs-repository');

function rowToDb(job) {
  return {
    id: job.jobId,
    tenant_id: job.tenantId,
    job_type: job.jobType,
    status: job.status,
    payload: job.payload,
    result: job.result,
    error: job.error,
    worker_id: job.workerId,
    claimed_at: job.claimedAt,
    heartbeat_at: job.heartbeatAt,
    completed_at: job.completedAt,
    retry_count: job.retryCount,
    max_retries: job.maxRetries,
    idempotency_key: job.idempotencyKey,
    next_retry_at: job.nextRetryAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

function createInMemoryJobsRepository({ staleSeconds = 900, now = () => new Date() } = {}) {
  /** @type {Map<string, object>} */
  const jobs = new Map();
  /** @type {Map<string, object>} */
  const heartbeats = new Map();

  function leaseTimestamp(job) {
    const heartbeat = job.heartbeatAt ? Date.parse(job.heartbeatAt) : 0;
    const claimed = job.claimedAt ? Date.parse(job.claimedAt) : 0;
    return Math.max(heartbeat, claimed);
  }

  function reclaimStaleRunning(staleSecs = staleSeconds) {
    const cutoff = now().getTime() - staleSecs * 1000;
    for (const job of jobs.values()) {
      if (job.status === 'running' && leaseTimestamp(job) > 0 && leaseTimestamp(job) < cutoff) {
        job.status = 'queued';
        job.workerId = null;
        job.claimedAt = null;
        job.heartbeatAt = null;
        job.updatedAt = now().toISOString();
      }
    }
  }

  return {
    jobs,
    heartbeats,

    async enqueue(tenantId, jobType, payload = {}, options = {}) {
      if (options.idempotencyKey) {
        const existing = [...jobs.values()].find(
          (j) => j.tenantId === tenantId && j.idempotencyKey === options.idempotencyKey && j.status !== 'failed',
        );
        if (existing) return { ...existing };
      }

      const jobId = randomUUID();
      const job = {
        jobId,
        tenantId,
        jobType,
        status: 'queued',
        payload,
        result: null,
        error: null,
        workerId: null,
        claimedAt: null,
        heartbeatAt: null,
        completedAt: null,
        retryCount: 0,
        maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
        idempotencyKey: options.idempotencyKey || null,
        nextRetryAt: null,
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
        pollUrl: `/api/jobs/${jobId}`,
      };
      jobs.set(jobId, job);
      return { ...job };
    },

    async findByIdempotencyKey(tenantId, idempotencyKey) {
      const job = [...jobs.values()].find(
        (j) => j.tenantId === tenantId && j.idempotencyKey === idempotencyKey,
      );
      return job ? { ...job } : null;
    },

    async getForTenant(tenantId, jobId) {
      const job = jobs.get(jobId);
      if (!job || job.tenantId !== tenantId) return null;
      return { ...job };
    },

    async claimNext(workerId, staleSecs = staleSeconds) {
      reclaimStaleRunning(staleSecs);
      const queued = [...jobs.values()]
        .filter((j) => j.status === 'queued' && (!j.nextRetryAt || Date.parse(j.nextRetryAt) <= now().getTime()))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      const job = queued[0];
      if (!job) return null;
      job.status = 'running';
      job.workerId = workerId;
      job.claimedAt = now().toISOString();
      job.heartbeatAt = job.claimedAt;
      job.updatedAt = job.claimedAt;
      return { ...job };
    },

    async renewLease(jobId, workerId) {
      const job = jobs.get(jobId);
      if (!job || job.workerId !== workerId || job.status !== 'running') return false;
      job.heartbeatAt = now().toISOString();
      job.updatedAt = job.heartbeatAt;
      return true;
    },

    async reclaimStale(staleSecs = staleSeconds) {
      const before = [...jobs.values()].filter((j) => j.status === 'running').length;
      reclaimStaleRunning(staleSecs);
      const after = [...jobs.values()].filter((j) => j.status === 'running').length;
      return before - after;
    },

    async heartbeat(workerId, metadata = {}) {
      heartbeats.set(workerId, { workerId, lastSeenAt: now().toISOString(), metadata });
    },

    async complete(jobId, workerId, result = {}) {
      const job = jobs.get(jobId);
      if (!job || job.workerId !== workerId || job.status !== 'running') {
        throw new Error(`BackgroundJobsRepository.complete lost lease for job ${jobId} (worker ${workerId})`);
      }
      job.status = 'completed';
      job.result = result;
      job.error = null;
      job.completedAt = now().toISOString();
      job.updatedAt = job.completedAt;
      return { ...job };
    },

    async fail(jobId, workerId, errorMessage, backoffSeconds = 30) {
      const job = jobs.get(jobId);
      if (!job || job.workerId !== workerId || job.status !== 'running') {
        throw new Error(`BackgroundJobsRepository.fail lost lease for job ${jobId} (worker ${workerId})`);
      }
      job.retryCount += 1;
      job.error = errorMessage;
      if (job.retryCount >= job.maxRetries) {
        job.status = 'dead_letter';
        job.completedAt = now().toISOString();
        job.workerId = null;
      } else {
        job.status = 'queued';
        job.workerId = null;
        job.claimedAt = null;
        job.heartbeatAt = null;
        job.nextRetryAt = new Date(now().getTime() + backoffSeconds * job.retryCount * 1000).toISOString();
      }
      job.updatedAt = now().toISOString();
      return { ...job };
    },

    toDbRows() {
      return [...jobs.values()].map(rowToDb);
    },
  };
}

module.exports = {
  createInMemoryJobsRepository,
};
