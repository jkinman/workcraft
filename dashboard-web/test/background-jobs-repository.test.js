import { describe, expect, it } from 'vitest';
import {
  BackgroundJobsRepository,
  DEFAULT_STALE_SECONDS,
  normalizeJobRow
} from '../lib/repositories/background-jobs-repository';

function makeFakeJobsClient() {
  const rows = new Map();
  let seq = 0;

  function rowSnapshot(row) {
    return { ...row, payload: { ...row.payload }, result: row.result ? { ...row.result } : null };
  }

  function claimNext(pWorkerId, pStaleSeconds = DEFAULT_STALE_SECONDS) {
    const now = Date.now();
    for (const row of rows.values()) {
      if (row.status === 'running' && row.claimed_at) {
        const claimedAt = new Date(row.claimed_at).getTime();
        if (now - claimedAt > pStaleSeconds * 1000) {
          row.status = 'queued';
          row.worker_id = null;
          row.claimed_at = null;
          row.updated_at = new Date().toISOString();
        }
      }
    }

    const queued = [...rows.values()]
      .filter(row => row.status === 'queued')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    if (!queued.length) return [];

    const row = queued[0];
    row.status = 'running';
    row.worker_id = pWorkerId;
    row.claimed_at = new Date().toISOString();
    row.updated_at = row.claimed_at;
    return [rowSnapshot(row)];
  }

  function reclaimStale(pStaleSeconds = DEFAULT_STALE_SECONDS) {
    const now = Date.now();
    let affected = 0;
    for (const row of rows.values()) {
      if (row.status === 'running' && row.claimed_at) {
        const claimedAt = new Date(row.claimed_at).getTime();
        if (now - claimedAt > pStaleSeconds * 1000) {
          row.status = 'queued';
          row.worker_id = null;
          row.claimed_at = null;
          row.updated_at = new Date().toISOString();
          affected += 1;
        }
      }
    }
    return affected;
  }

  function buildUpdateChain(values, filters = []) {
    return {
      eq(column, value) {
        return buildUpdateChain(values, [...filters, [column, value]]);
      },
      select() {
        return {
          single: async () => {
            const result = await this.maybeSingle();
            if (!result.data) {
              return { data: null, error: { message: 'not found' } };
            }
            return result;
          },
          maybeSingle: async () => {
            const match = [...rows.values()].find(row =>
              filters.every(([column, filterValue]) => row[column] === filterValue)
            );
            if (!match) {
              return { data: null, error: null };
            }
            Object.assign(match, {
              status: values.status,
              result: values.result,
              error: values.error,
              completed_at: values.completed_at,
              updated_at: values.updated_at
            });
            return { data: rowSnapshot(match), error: null };
          }
        };
      }
    };
  }

  return {
    rows,
    from(table) {
      if (table !== 'background_jobs') throw new Error(`Unexpected table: ${table}`);
      return {
        insert(values) {
          const payload = Array.isArray(values) ? values[0] : values;
          const id = `job-${++seq}`;
          const createdAt = new Date().toISOString();
          const row = {
            id,
            tenant_id: payload.tenant_id,
            job_type: payload.job_type,
            status: payload.status || 'queued',
            payload: payload.payload || {},
            result: null,
            error: null,
            worker_id: null,
            claimed_at: null,
            completed_at: null,
            created_at: createdAt,
            updated_at: createdAt
          };
          rows.set(id, row);
          return {
            select() {
              return {
                single: async () => ({ data: rowSnapshot(row), error: null })
              };
            }
          };
        },
        select() {
          return {
            eq(column, value) {
              const filters = { [column]: value };
              return {
                eq(nextColumn, nextValue) {
                  filters[nextColumn] = nextValue;
                  return {
                    maybeSingle: async () => {
                      const match = [...rows.values()].find(row =>
                        Object.entries(filters).every(([key, filterValue]) => row[key] === filterValue)
                      );
                      return { data: match ? rowSnapshot(match) : null, error: null };
                    }
                  };
                }
              };
            }
          };
        },
        update(values) {
          return buildUpdateChain(values);
        }
      };
    },
    rpc(name, args) {
      if (name === 'claim_next_background_job') {
        return Promise.resolve({ data: claimNext(args.p_worker_id, args.p_stale_seconds), error: null });
      }
      if (name === 'reclaim_stale_background_jobs') {
        return Promise.resolve({ data: reclaimStale(args.p_stale_seconds), error: null });
      }
      return Promise.resolve({ data: null, error: { message: `Unknown rpc ${name}` } });
    }
  };
}

function makeTerminalUpdateErrorClient(message) {
  return {
    from(table) {
      if (table !== 'background_jobs') throw new Error(`Unexpected table: ${table}`);
      return {
        update() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        select() {
                          return {
                            maybeSingle: async () => ({ data: null, error: { message } })
                          };
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

describe('BackgroundJobsRepository', () => {
  it('enqueues tenant-scoped jobs with normalized API fields', async () => {
    const client = makeFakeJobsClient();
    const repo = new BackgroundJobsRepository({ client });

    const job = await repo.enqueue('tenant-a', 'scan', { dryRun: true });

    expect(job).toMatchObject({
      tenantId: 'tenant-a',
      jobType: 'scan',
      status: 'queued',
      pollUrl: `/api/jobs/${job.jobId}`
    });
    expect(normalizeJobRow(null)).toBeNull();
    expect(DEFAULT_STALE_SECONDS).toBe(900);
  });

  it('isolates getForTenant lookups by tenant id', async () => {
    const client = makeFakeJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'pdf', { kind: 'resume' });

    await expect(repo.getForTenant('tenant-a', job.jobId)).resolves.toMatchObject({ jobId: job.jobId });
    await expect(repo.getForTenant('tenant-b', job.jobId)).resolves.toBeNull();
  });

  it('claims, completes, and fails jobs through rpc and lease-scoped updates', async () => {
    const client = makeFakeJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'scan', {});

    const claimed = await repo.claimNext('worker-1');
    expect(claimed?.jobId).toBe(job.jobId);
    expect(claimed?.status).toBe('running');

    const completed = await repo.complete(job.jobId, 'worker-1', { totalFound: 4 });
    expect(completed.status).toBe('completed');
    expect(completed.result).toEqual({ totalFound: 4 });

    const failedJob = await repo.enqueue('tenant-a', 'pdf', { kind: 'resume' });
    await repo.claimNext('worker-1');
    const failed = await repo.fail(failedJob.jobId, 'worker-1', 'boom');
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('boom');
  });

  it('throws when supabase returns a terminal update error', async () => {
    const repo = new BackgroundJobsRepository({
      client: makeTerminalUpdateErrorClient('permission denied')
    });

    await expect(repo.complete('job-1', 'worker-1', {})).rejects.toThrow(
      'BackgroundJobsRepository.completed failed: permission denied'
    );
  });

  it('throws lost-lease when complete/fail worker does not own a running job', async () => {
    const client = makeFakeJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'scan', {});
    await repo.claimNext('worker-1');

    await expect(repo.complete(job.jobId, 'worker-2', {})).rejects.toThrow(
      `BackgroundJobsRepository.completed lost lease for job ${job.jobId} (worker worker-2)`
    );
    await expect(repo.fail(job.jobId, 'worker-2', 'boom')).rejects.toThrow('lost lease');
    await expect(repo.complete(job.jobId, 'worker-1', {})).resolves.toMatchObject({ status: 'completed' });
  });

  it('requires workerId for terminal updates', async () => {
    const repo = new BackgroundJobsRepository({ client: makeFakeJobsClient() });
    await expect(repo.complete('job-1', '', {})).rejects.toThrow('requires workerId');
    await expect(repo.fail('job-1', null, 'boom')).rejects.toThrow('requires workerId');
  });

  it('reclaims stale running jobs', async () => {
    const client = makeFakeJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'scan', {});
    const claimed = await repo.claimNext('worker-1');
    client.rows.get(claimed.jobId).claimed_at = new Date(Date.now() - 1_000_000).toISOString();

    const reclaimed = await repo.reclaimStale(DEFAULT_STALE_SECONDS);
    expect(reclaimed).toBe(1);
    await expect(repo.getForTenant('tenant-a', job.jobId)).resolves.toMatchObject({ status: 'queued' });
  });
});
