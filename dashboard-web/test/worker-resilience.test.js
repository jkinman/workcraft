import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createInMemoryJobsRepository } from './fakes/in-memory-jobs-repository';
import { processJob, runWorkerLoop } from '../lib/worker/worker-runner';

describe('worker resilience contracts', () => {
  let clock;
  let nowMs;

  beforeEach(() => {
    nowMs = Date.now();
    clock = () => new Date(nowMs);
  });

  it('enforces lease owner on complete and fail', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    const job = await repo.enqueue('tenant-a', 'scan', { dryRun: true });
    const claimed = await repo.claimNext('worker-a');
    expect(claimed.jobId).toBe(job.jobId);

    await expect(repo.complete(job.jobId, 'worker-b', {})).rejects.toThrow(/lost lease/);
    await expect(repo.fail(job.jobId, 'worker-b', 'err')).rejects.toThrow(/lost lease/);

    const completed = await repo.complete(job.jobId, 'worker-a', { ok: true });
    expect(completed.status).toBe('completed');
  });

  it('renews heartbeat lease for running worker', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    const job = await repo.enqueue('tenant-a', 'pdf', { kind: 'resume' });
    await repo.claimNext('worker-a');
    expect(await repo.renewLease(job.jobId, 'worker-a')).toBe(true);
    expect(await repo.renewLease(job.jobId, 'worker-b')).toBe(false);
  });

  it('reclaims stale running jobs for competing workers', async () => {
    const repo = createInMemoryJobsRepository({ staleSeconds: 60, now: clock });
    const job = await repo.enqueue('tenant-a', 'scan', {});
    await repo.claimNext('worker-a');

    nowMs += 120_000;
    const reclaimed = await repo.reclaimStale(60);
    expect(reclaimed).toBe(1);

    const claimedByB = await repo.claimNext('worker-b');
    expect(claimedByB.jobId).toBe(job.jobId);
    expect(claimedByB.workerId).toBe('worker-b');
  });

  it('retries with backoff then dead-letters after max retries', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    const job = await repo.enqueue('tenant-a', 'evaluation', { jdText: 'x'.repeat(80) }, { maxRetries: 2 });
    await repo.claimNext('worker-a');

    const first = await repo.fail(job.jobId, 'worker-a', 'transient', 10);
    expect(first.status).toBe('queued');
    expect(first.retryCount).toBe(1);

    nowMs += 60_000;
    await repo.claimNext('worker-b');
    const dead = await repo.fail(job.jobId, 'worker-b', 'still failing', 10);
    expect(dead.status).toBe('dead_letter');
    expect(dead.retryCount).toBe(2);
  });

  it('deduplicates enqueue by idempotency key', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    const a = await repo.enqueue('tenant-a', 'scan', { dryRun: true }, { idempotencyKey: 'scan-1' });
    const b = await repo.enqueue('tenant-a', 'scan', { dryRun: true }, { idempotencyKey: 'scan-1' });
    expect(b.jobId).toBe(a.jobId);
    expect(repo.jobs.size).toBe(1);
  });

  it('records structured worker heartbeats', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    await repo.heartbeat('worker-a', { status: 'idle' });
    expect(repo.heartbeats.get('worker-a').metadata.status).toBe('idle');
  });

  it('processes job with structured result via worker runner', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    await repo.enqueue('tenant-a', 'scan', { dryRun: true });
    const claimed = await repo.claimNext('worker-a');

    const outcome = await processJob(claimed, {
      workerId: 'worker-a',
      jobsRepository: repo,
      supabaseClient: {},
      executeJobFn: async () => ({ dryRun: true, metricsSource: 'fake' }),
    });
    expect(outcome.outcome).toBe('completed');
  });

  it('handles crash/reclaim between competing workers without double complete', async () => {
    const repo = createInMemoryJobsRepository({ staleSeconds: 1, now: clock });
    const job = await repo.enqueue('tenant-a', 'pdf', { kind: 'resume' });
    const claimed = await repo.claimNext('worker-a');
    nowMs += 5000;
    await repo.reclaimStale(1);

    const claimedB = await repo.claimNext('worker-b');
    expect(claimedB.jobId).toBe(job.jobId);

    const completed = await repo.complete(job.jobId, 'worker-b', { success: true });
    expect(completed.status).toBe('completed');
    await expect(repo.complete(job.jobId, 'worker-a', {})).rejects.toThrow(/lost lease/);
  });

  it('does not reclaim healthy long-running jobs when heartbeat is renewed', async () => {
    const repo = createInMemoryJobsRepository({ staleSeconds: 60, now: clock });
    const job = await repo.enqueue('tenant-a', 'scan', {});
    await repo.claimNext('worker-a');

    nowMs += 45_000;
    await repo.renewLease(job.jobId, 'worker-a');

    nowMs += 45_000;
    const reclaimed = await repo.reclaimStale(60);
    expect(reclaimed).toBe(0);
    expect(repo.jobs.get(job.jobId).status).toBe('running');
  });

  it('aborts execution and skips completion when renewLease returns false', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    await repo.enqueue('tenant-a', 'scan', { dryRun: true });
    const claimed = await repo.claimNext('worker-a');

    const originalRenew = repo.renewLease.bind(repo);
    repo.renewLease = async (jobId, workerId) => {
      if (workerId === 'worker-a') return false;
      return originalRenew(jobId, workerId);
    };

    let executeCompleted = false;
    const outcome = await processJob(claimed, {
      workerId: 'worker-a',
      jobsRepository: repo,
      supabaseClient: {},
      heartbeatMs: 5,
      executeJobFn: async (_job, { signal }) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            executeCompleted = true;
            resolve({ ok: true });
          }, 50);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted due to lease loss'));
          });
        });
        return { ok: true };
      },
    });

    expect(outcome.outcome).toBe('lease_lost');
    expect(executeCompleted).toBe(false);
    const jobAfter = repo.jobs.get(claimed.jobId);
    expect(jobAfter.status).toBe('running');
    expect(jobAfter.result).toBeNull();
  });

  it('supports graceful shutdown flag on worker loop', async () => {
    const repo = createInMemoryJobsRepository({ now: clock });
    const controller = new AbortController();
    controller.abort();

    const result = await runWorkerLoop({
      workerId: 'worker-shutdown',
      jobsRepository: repo,
      supabaseClient: {},
      once: true,
      signal: controller.signal,
      executeJobFn: async () => ({}),
    });
    expect(result.graceful).toBe(true);
  });
});
