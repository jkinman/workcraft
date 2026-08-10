const { createSupabaseServerClient } = require('./supabase-client');

const DEFAULT_STALE_SECONDS = 900;
const JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed']);
const JOB_TYPES = new Set(['scan', 'pdf']);

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
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pollUrl: `/api/jobs/${row.id}`
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
  constructor({ client, env = process.env } = {}) {
    this.client = client || createSupabaseServerClient(env);
  }

  async enqueue(tenantId, jobType, payload = {}) {
    if (!tenantId) throw new Error('BackgroundJobsRepository.enqueue requires tenantId');
    assertJobType(jobType);

    const { data, error } = await this.client
      .from('background_jobs')
      .insert({
        tenant_id: tenantId,
        job_type: jobType,
        status: 'queued',
        payload
      })
      .select('*')
      .single();

    if (error) throw new Error(`BackgroundJobsRepository.enqueue failed: ${error.message}`);
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
      p_stale_seconds: staleSeconds
    });

    if (error) throw new Error(`BackgroundJobsRepository.claimNext failed: ${error.message}`);
    return normalizeJobRow(Array.isArray(data) ? data[0] : data);
  }

  async reclaimStale(staleSeconds = DEFAULT_STALE_SECONDS) {
    const { data, error } = await this.client.rpc('reclaim_stale_background_jobs', {
      p_stale_seconds: staleSeconds
    });

    if (error) throw new Error(`BackgroundJobsRepository.reclaimStale failed: ${error.message}`);
    return data || 0;
  }

  async complete(jobId, workerId, result = {}) {
    if (!workerId) throw new Error('BackgroundJobsRepository.complete requires workerId');
    return this.#setTerminalState(jobId, workerId, 'completed', { result, error: null });
  }

  async fail(jobId, workerId, errorMessage) {
    if (!workerId) throw new Error('BackgroundJobsRepository.fail requires workerId');
    return this.#setTerminalState(jobId, workerId, 'failed', {
      result: null,
      error: errorMessage || 'Job failed'
    });
  }

  async #setTerminalState(jobId, workerId, status, { result, error }) {
    assertJobStatus(status);

    const { data, error: updateError } = await this.client
      .from('background_jobs')
      .update({
        status,
        result,
        error,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('worker_id', workerId)
      .eq('status', 'running')
      .select('*')
      .maybeSingle();

    if (updateError) {
      throw new Error(`BackgroundJobsRepository.${status} failed: ${updateError.message}`);
    }
    if (!data) {
      throw new Error(
        `BackgroundJobsRepository.${status} lost lease for job ${jobId} (worker ${workerId})`
      );
    }
    return normalizeJobRow(data);
  }
}

function createBackgroundJobsRepository(options = {}) {
  return new BackgroundJobsRepository(options);
}

module.exports = {
  BackgroundJobsRepository,
  DEFAULT_STALE_SECONDS,
  createBackgroundJobsRepository,
  normalizeJobRow
};
