const { createSupabaseServerClient, assertServiceRoleAllowed } = require('./supabase-client');

const DEFAULT_STALE_SECONDS = 900;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_SECONDS = 30;
const JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'dead_letter']);
const JOB_TYPES = new Set(['scan', 'pdf', 'evaluation']);

function normalizeJobRow(row) {
  if (!row) return null;

  return {
    jobId: row.id,
    tenantId: row.tenant_id,
    jobType: row.job_type,
    status: row.status,
    payload: row.payload || {},
    result: row.result || null,
    error: row.error || null,
    workerId: row.worker_id || null,
    claimedAt: row.claimed_at || null,
    heartbeatAt: row.heartbeat_at || null,
    completedAt: row.completed_at || null,
    retryCount: row.retry_count ?? 0,
    maxRetries: row.max_retries ?? DEFAULT_MAX_RETRIES,
    idempotencyKey: row.idempotency_key || null,
    nextRetryAt: row.next_retry_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pollUrl: `/api/jobs/${row.id}`,
  };
}

function assertJobType(jobType) {
  if (!JOB_TYPES.has(jobType)) {
    throw new Error(`Invalid job type: ${jobType}`);
  }
}

function assertJobStatus(status) {
  if (!JOB_STATUSES.has(status)) {
    throw new Error(`Invalid job status: ${status}`);
  }
}

class BackgroundJobsRepository {
  constructor({ client, env = process.env, allowServiceRole = false } = {}) {
    if (!client) {
      if (!allowServiceRole) {
        throw new Error('BackgroundJobsRepository requires an injected Supabase client');
      }
      client = createSupabaseServerClient(env);
    }
    assertServiceRoleAllowed(client, {
      allowServiceRole,
      context: 'BackgroundJobsRepository',
    });
    this.client = client;
    this.allowServiceRole = allowServiceRole;
  }

  async enqueue(tenantId, jobType, payload = {}, options = {}) {
    if (!tenantId) throw new Error('BackgroundJobsRepository.enqueue requires tenantId');
    assertJobType(jobType);

    if (options.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(tenantId, options.idempotencyKey);
      if (existing && existing.status !== 'failed') {
        return existing;
      }
    }

    const { data, error } = await this.client
      .from('background_jobs')
      .insert({
        tenant_id: tenantId,
        job_type: jobType,
        status: 'queued',
        payload,
        idempotency_key: options.idempotencyKey || null,
        max_retries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      })
      .select('*')
      .single();

    if (error) throw new Error(`BackgroundJobsRepository.enqueue failed: ${error.message}`);
    return normalizeJobRow(data);
  }

  async findByIdempotencyKey(tenantId, idempotencyKey) {
    if (!tenantId || !idempotencyKey) return null;

    const { data, error } = await this.client
      .from('background_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) throw new Error(`BackgroundJobsRepository.findByIdempotencyKey failed: ${error.message}`);
    return normalizeJobRow(data);
  }

  async getForTenant(tenantId, jobId) {
    if (!tenantId || !jobId) return null;

    const { data, error } = await this.client
      .from('background_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', jobId)
      .maybeSingle();

    if (error) throw new Error(`BackgroundJobsRepository.getForTenant failed: ${error.message}`);
    return normalizeJobRow(data);
  }

  async claimNext(workerId, staleSeconds = DEFAULT_STALE_SECONDS) {
    if (!workerId) throw new Error('BackgroundJobsRepository.claimNext requires workerId');

    const { data, error } = await this.client.rpc('claim_next_background_job', {
      p_worker_id: workerId,
      p_stale_seconds: staleSeconds,
    });

    if (error) throw new Error(`BackgroundJobsRepository.claimNext failed: ${error.message}`);
    return normalizeJobRow(Array.isArray(data) ? data[0] : data);
  }

  async renewLease(jobId, workerId) {
    const { data, error } = await this.client.rpc('renew_job_lease', {
      p_job_id: jobId,
      p_worker_id: workerId,
    });

    if (error) throw new Error(`BackgroundJobsRepository.renewLease failed: ${error.message}`);
    return Boolean(data);
  }

  async reclaimStale(staleSeconds = DEFAULT_STALE_SECONDS) {
    const { data, error } = await this.client.rpc('reclaim_stale_background_jobs', {
      p_stale_seconds: staleSeconds,
    });

    if (error) throw new Error(`BackgroundJobsRepository.reclaimStale failed: ${error.message}`);
    return data || 0;
  }

  async heartbeat(workerId, metadata = {}) {
    const { error } = await this.client.rpc('upsert_worker_heartbeat', {
      p_worker_id: workerId,
      p_metadata: metadata,
    });

    if (error) throw new Error(`BackgroundJobsRepository.heartbeat failed: ${error.message}`);
  }

  async complete(jobId, workerId, result = {}) {
    if (!workerId) throw new Error('BackgroundJobsRepository.complete requires workerId');

    const { data, error } = await this.client.rpc('complete_background_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_result: result,
    });

    if (error) throw new Error(`BackgroundJobsRepository.complete failed: ${error.message}`);
    const row = normalizeJobRow(Array.isArray(data) ? data[0] : data);
    if (!row) {
      throw new Error(`BackgroundJobsRepository.complete lost lease for job ${jobId} (worker ${workerId})`);
    }
    return row;
  }

  async fail(jobId, workerId, errorMessage, backoffSeconds = DEFAULT_BACKOFF_SECONDS) {
    if (!workerId) throw new Error('BackgroundJobsRepository.fail requires workerId');

    const { data, error } = await this.client.rpc('fail_background_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_error: errorMessage || 'Job failed',
      p_backoff_seconds: backoffSeconds,
    });

    if (error) throw new Error(`BackgroundJobsRepository.fail failed: ${error.message}`);
    const row = normalizeJobRow(Array.isArray(data) ? data[0] : data);
    if (!row) {
      throw new Error(`BackgroundJobsRepository.fail lost lease for job ${jobId} (worker ${workerId})`);
    }
    return row;
  }
}

function createBackgroundJobsRepository(options = {}) {
  return new BackgroundJobsRepository(options);
}

function createWorkerBackgroundJobsRepository(env = process.env) {
  return new BackgroundJobsRepository({ allowServiceRole: true, env });
}

module.exports = {
  BackgroundJobsRepository,
  DEFAULT_BACKOFF_SECONDS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_STALE_SECONDS,
  createBackgroundJobsRepository,
  createWorkerBackgroundJobsRepository,
  normalizeJobRow,
};
