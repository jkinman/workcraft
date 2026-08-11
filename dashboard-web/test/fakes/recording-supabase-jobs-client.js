/**
 * Recording Supabase stub for BackgroundJobsRepository contract tests.
 * Implements background_jobs table chains and worker RPCs with call recording.
 */

const { DEFAULT_STALE_SECONDS } = require('../../lib/repositories/background-jobs-repository');

function rowSnapshot(row) {
  return {
    ...row,
    payload: { ...(row.payload || {}) },
    result: row.result ? { ...row.result } : null,
  };
}

function createRecordingSupabaseJobsClient(options = {}) {
  const rows = new Map();
  let seq = 0;
  const recordings = {
    from: [],
    rpc: [],
  };

  function recordFrom(action, table, detail = {}) {
    recordings.from.push({ action, table, ...detail });
  }

  function recordRpc(name, args, result) {
    recordings.rpc.push({ name, args: { ...args }, result });
  }

  function leaseAgeMs(row, nowMs) {
    const heartbeat = row.heartbeat_at ? new Date(row.heartbeat_at).getTime() : 0;
    const claimed = row.claimed_at ? new Date(row.claimed_at).getTime() : 0;
    const leaseAt = Math.max(heartbeat, claimed);
    return leaseAt > 0 ? nowMs - leaseAt : 0;
  }

  function claimNext(pWorkerId, pStaleSeconds = DEFAULT_STALE_SECONDS) {
    const now = Date.now();
    for (const row of rows.values()) {
      if (row.status === 'running' && leaseAgeMs(row, now) > pStaleSeconds * 1000) {
        row.status = 'queued';
        row.worker_id = null;
        row.claimed_at = null;
        row.heartbeat_at = null;
        row.updated_at = new Date().toISOString();
      }
    }

    const queued = [...rows.values()]
      .filter((row) => row.status === 'queued')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    if (!queued.length) return [];

    const row = queued[0];
    row.status = 'running';
    row.worker_id = pWorkerId;
    row.claimed_at = new Date().toISOString();
    row.heartbeat_at = row.claimed_at;
    row.updated_at = row.claimed_at;
    return [rowSnapshot(row)];
  }

  function completeJob(pJobId, pWorkerId, pResult = {}) {
    const row = rows.get(pJobId);
    if (!row || row.worker_id !== pWorkerId || row.status !== 'running') return [];
    row.status = 'completed';
    row.result = pResult;
    row.error = null;
    row.completed_at = new Date().toISOString();
    row.updated_at = row.completed_at;
    return [rowSnapshot(row)];
  }

  function failJob(pJobId, pWorkerId, pError, pBackoffSeconds = 30) {
    const row = rows.get(pJobId);
    if (!row || row.worker_id !== pWorkerId || row.status !== 'running') return [];
    row.retry_count += 1;
    row.error = pError;
    if (row.retry_count >= row.max_retries) {
      row.status = 'dead_letter';
      row.completed_at = new Date().toISOString();
      row.worker_id = null;
    } else {
      row.status = 'queued';
      row.worker_id = null;
      row.claimed_at = null;
      row.heartbeat_at = null;
      row.next_retry_at = new Date(Date.now() + pBackoffSeconds * row.retry_count * 1000).toISOString();
    }
    row.updated_at = new Date().toISOString();
    return [rowSnapshot(row)];
  }

  function renewLease(pJobId, pWorkerId) {
    if (typeof options.renewLeaseHook === 'function') {
      const hookResult = options.renewLeaseHook(pJobId, pWorkerId, rows.get(pJobId));
      if (hookResult !== undefined) return hookResult;
    }
    const row = rows.get(pJobId);
    if (!row || row.worker_id !== pWorkerId || row.status !== 'running') return false;
    row.heartbeat_at = new Date().toISOString();
    row.updated_at = row.heartbeat_at;
    return true;
  }

  function reclaimStale(pStaleSeconds = DEFAULT_STALE_SECONDS) {
    const now = Date.now();
    let affected = 0;
    for (const row of rows.values()) {
      if (row.status === 'running' && leaseAgeMs(row, now) > pStaleSeconds * 1000) {
        row.status = 'queued';
        row.worker_id = null;
        row.claimed_at = null;
        row.heartbeat_at = null;
        row.updated_at = new Date().toISOString();
        affected += 1;
      }
    }
    return affected;
  }

  const client = {
    rows,
    recordings,
    from(table) {
      if (table !== 'background_jobs') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        insert(values) {
          recordFrom('insert', table, { values: Array.isArray(values) ? values[0] : values });
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
            heartbeat_at: null,
            completed_at: null,
            retry_count: 0,
            max_retries: payload.max_retries ?? 3,
            idempotency_key: payload.idempotency_key ?? null,
            next_retry_at: null,
            created_at: createdAt,
            updated_at: createdAt,
          };
          rows.set(id, row);
          return {
            select() {
              recordFrom('insert.select', table);
              return {
                single: async () => {
                  const data = rowSnapshot(row);
                  recordFrom('insert.select.single', table, { data });
                  return { data, error: null };
                },
              };
            },
          };
        },
        select(columns = '*') {
          recordFrom('select', table, { columns });
          return {
            eq(column, value) {
              const filters = { [column]: value };
              recordFrom('select.eq', table, { filters: { ...filters } });
              return {
                eq(nextColumn, nextValue) {
                  filters[nextColumn] = nextValue;
                  recordFrom('select.eq.eq', table, { filters: { ...filters } });
                  return {
                    maybeSingle: async () => {
                      const match = [...rows.values()].find((row) =>
                        Object.entries(filters).every(([key, filterValue]) => row[key] === filterValue),
                      );
                      const data = match ? rowSnapshot(match) : null;
                      recordFrom('select.eq.eq.maybeSingle', table, { filters: { ...filters }, data });
                      return { data, error: null };
                    },
                  };
                },
                maybeSingle: async () => {
                  const match = [...rows.values()].find((row) =>
                    Object.entries(filters).every(([key, filterValue]) => row[key] === filterValue),
                  );
                  const data = match ? rowSnapshot(match) : null;
                  recordFrom('select.eq.maybeSingle', table, { filters: { ...filters }, data });
                  return { data, error: null };
                },
              };
            },
          };
        },
      };
    },
    rpc(name, args = {}) {
      if (options.rpcErrors?.[name]) {
        const error = options.rpcErrors[name];
        recordRpc(name, args, { error });
        return Promise.resolve({ data: null, error });
      }

      let data;
      if (name === 'claim_next_background_job') {
        data = claimNext(args.p_worker_id, args.p_stale_seconds);
      } else if (name === 'reclaim_stale_background_jobs') {
        data = reclaimStale(args.p_stale_seconds);
      } else if (name === 'complete_background_job') {
        data = completeJob(args.p_job_id, args.p_worker_id, args.p_result);
      } else if (name === 'fail_background_job') {
        data = failJob(args.p_job_id, args.p_worker_id, args.p_error, args.p_backoff_seconds);
      } else if (name === 'renew_job_lease') {
        data = renewLease(args.p_job_id, args.p_worker_id);
      } else if (name === 'upsert_worker_heartbeat') {
        data = { worker_id: args.p_worker_id };
      } else {
        const error = { message: `Unknown rpc ${name}` };
        recordRpc(name, args, { error });
        return Promise.resolve({ data: null, error });
      }

      recordRpc(name, args, { data });
      return Promise.resolve({ data, error: null });
    },
  };

  return client;
}

module.exports = {
  createRecordingSupabaseJobsClient,
};
