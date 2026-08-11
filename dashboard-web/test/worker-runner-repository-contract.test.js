import { describe, expect, it, vi } from 'vitest';
import { BackgroundJobsRepository } from '../lib/repositories/background-jobs-repository';
import { processJob, runWorkerLoop } from '../lib/worker/worker-runner';
import { createRecordingSupabaseJobsClient } from './fakes/recording-supabase-jobs-client';

function createRepository(client) {
  return new BackgroundJobsRepository({ client });
}

describe('worker runner with BackgroundJobsRepository contract', () => {
  it('claims and completes a hosted job through repository RPCs', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = createRepository(client);
    await repo.enqueue('tenant-a', 'scan', { dryRun: true });

    const loopResult = await runWorkerLoop({
      workerId: 'worker-contract',
      jobsRepository: repo,
      supabaseClient: {},
      once: true,
      pollIntervalMs: 1,
      executeJobFn: async () => ({ dryRun: true, metricsSource: 'contract' }),
      log: () => {},
    });

    expect(loopResult.workerId).toBe('worker-contract');
    const completedRpc = client.recordings.rpc.find((entry) => entry.name === 'complete_background_job');
    expect(completedRpc?.args.p_worker_id).toBe('worker-contract');
    expect(completedRpc?.args.p_result).toMatchObject({ dryRun: true, metricsSource: 'contract' });
    expect(client.recordings.rpc.some((entry) => entry.name === 'claim_next_background_job')).toBe(true);
    expect(client.recordings.rpc.some((entry) => entry.name === 'upsert_worker_heartbeat')).toBe(true);
  });

  it('marks unsuccessful execution through fail_background_job with backoff', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = createRepository(client);
    const job = await repo.enqueue('tenant-a', 'evaluation', { jdText: 'x'.repeat(80) }, { maxRetries: 3 });
    const claimed = await repo.claimNext('worker-fail');

    const outcome = await processJob(claimed, {
      workerId: 'worker-fail',
      jobsRepository: repo,
      supabaseClient: {},
      heartbeatMs: 60_000,
      executeJobFn: async () => ({ success: false, error: 'gateway timeout' }),
      log: () => {},
    });

    expect(outcome.outcome).toBe('queued');
    const failRpc = client.recordings.rpc.find((entry) => entry.name === 'fail_background_job');
    expect(failRpc?.args).toMatchObject({
      p_job_id: job.jobId,
      p_worker_id: 'worker-fail',
      p_error: 'gateway timeout',
      p_backoff_seconds: 30,
    });
    expect(client.rows.get(job.jobId).status).toBe('queued');
    expect(client.rows.get(job.jobId).retry_count).toBe(1);
  });

  it('dead-letters exhausted jobs after repeated worker failures', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = createRepository(client);
    const job = await repo.enqueue('tenant-a', 'evaluation', { jdText: 'y'.repeat(80) }, { maxRetries: 2 });

    await runWorkerLoop({
      workerId: 'worker-retry-a',
      jobsRepository: repo,
      supabaseClient: {},
      once: true,
      pollIntervalMs: 1,
      executeJobFn: async () => {
        throw new Error('still failing');
      },
      log: () => {},
    });

    await runWorkerLoop({
      workerId: 'worker-retry-b',
      jobsRepository: repo,
      supabaseClient: {},
      once: true,
      pollIntervalMs: 1,
      executeJobFn: async () => {
        throw new Error('still failing');
      },
      log: () => {},
    });

    const row = client.rows.get(job.jobId);
    expect(row.status).toBe('dead_letter');
    expect(row.retry_count).toBe(2);
    expect(client.recordings.rpc.filter((entry) => entry.name === 'fail_background_job')).toHaveLength(2);
  });

  it('aborts cooperatively when renewLease reports ownership loss', async () => {
    vi.useFakeTimers();
    try {
      const client = createRecordingSupabaseJobsClient({
        renewLeaseHook: () => false,
      });
      const repo = createRepository(client);
      await repo.enqueue('tenant-a', 'scan', { dryRun: true });
      const claimed = await repo.claimNext('worker-lease');

      let executeSettled = false;
      const outcomePromise = processJob(claimed, {
        workerId: 'worker-lease',
        jobsRepository: repo,
        supabaseClient: {},
        heartbeatMs: 5,
        executeJobFn: async (_job, { signal }) => {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              executeSettled = true;
              resolve({ ok: true });
            }, 100);
            signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('aborted'));
            });
          });
          return { ok: true };
        },
        log: () => {},
      });

      await vi.advanceTimersByTimeAsync(10);
      const outcome = await outcomePromise;

      expect(outcome.outcome).toBe('lease_lost');
      expect(executeSettled).toBe(false);
      expect(client.rows.get(claimed.jobId).status).toBe('running');
      expect(client.recordings.rpc.some((entry) => entry.name === 'complete_background_job')).toBe(false);
      expect(client.recordings.rpc.some((entry) => entry.name === 'fail_background_job')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns lease_lost when fail RPC rejects after execution error', async () => {
    const client = createRecordingSupabaseJobsClient({
      rpcErrors: { fail_background_job: { message: 'lease revoked' } },
    });
    const repo = createRepository(client);
    const job = await repo.enqueue('tenant-a', 'pdf', { kind: 'resume' });
    const claimed = await repo.claimNext('worker-drop');

    const outcome = await processJob(claimed, {
      workerId: 'worker-drop',
      jobsRepository: repo,
      supabaseClient: {},
      heartbeatMs: 60_000,
      executeJobFn: async () => {
        throw new Error('render failed');
      },
      log: () => {},
    });

    expect(outcome.outcome).toBe('lease_lost');
    expect(outcome.error).toBe('render failed');
    expect(client.rows.get(job.jobId).status).toBe('running');
  });
});
