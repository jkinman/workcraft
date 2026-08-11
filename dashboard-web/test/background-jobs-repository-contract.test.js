import { describe, expect, it } from 'vitest';
import {
  BackgroundJobsRepository,
  DEFAULT_BACKOFF_SECONDS,
  DEFAULT_STALE_SECONDS,
  normalizeJobRow,
} from '../lib/repositories/background-jobs-repository';
import { createRecordingSupabaseJobsClient } from './fakes/recording-supabase-jobs-client';

describe('BackgroundJobsRepository supabase contract', () => {
  it('records background_jobs insert chain and normalizes enqueue fields', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = new BackgroundJobsRepository({ client });

    const job = await repo.enqueue('tenant-a', 'evaluation', { jdText: 'x'.repeat(80) }, {
      idempotencyKey: 'eval-1',
      maxRetries: 5,
    });

    expect(job).toMatchObject({
      tenantId: 'tenant-a',
      jobType: 'evaluation',
      status: 'queued',
      retryCount: 0,
      maxRetries: 5,
      idempotencyKey: 'eval-1',
      pollUrl: `/api/jobs/${job.jobId}`,
    });

    expect(client.recordings.from.map((entry) => entry.action)).toEqual([
      'select',
      'select.eq',
      'select.eq.eq',
      'select.eq.eq.maybeSingle',
      'insert',
      'insert.select',
      'insert.select.single',
    ]);
    expect(client.recordings.from.find((entry) => entry.action === 'insert')?.values).toMatchObject({
      tenant_id: 'tenant-a',
      job_type: 'evaluation',
      status: 'queued',
      idempotency_key: 'eval-1',
      max_retries: 5,
    });
  });

  it('deduplicates enqueue through idempotency lookup without a second insert', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = new BackgroundJobsRepository({ client });

    const first = await repo.enqueue('tenant-a', 'scan', { dryRun: true }, { idempotencyKey: 'scan-once' });
    const insertCountAfterFirst = client.recordings.from.filter((entry) => entry.action === 'insert').length;

    const second = await repo.enqueue('tenant-a', 'scan', { dryRun: true }, { idempotencyKey: 'scan-once' });
    const insertCountAfterSecond = client.recordings.from.filter((entry) => entry.action === 'insert').length;

    expect(second.jobId).toBe(first.jobId);
    expect(insertCountAfterSecond).toBe(insertCountAfterFirst);
    expect(client.rows.size).toBe(1);
  });

  it('records tenant-scoped getForTenant select chains', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'pdf', { kind: 'resume' });

    client.recordings.from.length = 0;
    await repo.getForTenant('tenant-a', job.jobId);
    await repo.getForTenant('tenant-b', job.jobId);

    const maybeSingleCalls = client.recordings.from.filter(
      (entry) => entry.action === 'select.eq.eq.maybeSingle',
    );
    expect(maybeSingleCalls).toEqual([
      expect.objectContaining({
        filters: { tenant_id: 'tenant-a', id: job.jobId },
        data: expect.objectContaining({ tenant_id: 'tenant-a', id: job.jobId }),
      }),
      expect.objectContaining({
        filters: { tenant_id: 'tenant-b', id: job.jobId },
        data: null,
      }),
    ]);
  });

  it('uses claim/complete/fail RPC names with expected arguments', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'scan', {});

    client.recordings.rpc.length = 0;
    const claimed = await repo.claimNext('worker-a', 120);
    expect(claimed.status).toBe('running');
    expect(client.recordings.rpc[0]).toEqual({
      name: 'claim_next_background_job',
      args: { p_worker_id: 'worker-a', p_stale_seconds: 120 },
      result: { data: [expect.objectContaining({ id: job.jobId, status: 'running' })] },
    });

    client.recordings.rpc.length = 0;
    const completed = await repo.complete(job.jobId, 'worker-a', { totalFound: 2 });
    expect(completed.result).toEqual({ totalFound: 2 });
    expect(client.recordings.rpc[0]).toEqual({
      name: 'complete_background_job',
      args: {
        p_job_id: job.jobId,
        p_worker_id: 'worker-a',
        p_result: { totalFound: 2 },
      },
      result: { data: [expect.objectContaining({ status: 'completed' })] },
    });

    const retryJob = await repo.enqueue('tenant-a', 'evaluation', {}, { maxRetries: 1 });
    await repo.claimNext('worker-b');
    client.recordings.rpc.length = 0;
    const failed = await repo.fail(retryJob.jobId, 'worker-b', 'boom', 45);
    expect(failed.status).toBe('dead_letter');
    expect(client.recordings.rpc[0]).toEqual({
      name: 'fail_background_job',
      args: {
        p_job_id: retryJob.jobId,
        p_worker_id: 'worker-b',
        p_error: 'boom',
        p_backoff_seconds: 45,
      },
      result: { data: [expect.objectContaining({ status: 'dead_letter', error: 'boom' })] },
    });
  });

  it('records renewLease, heartbeat, and reclaim RPC contracts', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'scan', {});
    await repo.claimNext('worker-a');

    client.recordings.rpc.length = 0;
    await repo.renewLease(job.jobId, 'worker-a');
    await repo.heartbeat('worker-a', { status: 'running', jobId: job.jobId });
    await repo.reclaimStale(DEFAULT_STALE_SECONDS);

    expect(client.recordings.rpc.map((entry) => entry.name)).toEqual([
      'renew_job_lease',
      'upsert_worker_heartbeat',
      'reclaim_stale_background_jobs',
    ]);
    expect(client.recordings.rpc[0].args).toEqual({
      p_job_id: job.jobId,
      p_worker_id: 'worker-a',
    });
    expect(client.recordings.rpc[1].args).toEqual({
      p_worker_id: 'worker-a',
      p_metadata: { status: 'running', jobId: job.jobId },
    });
    expect(client.recordings.rpc[2].args).toEqual({ p_stale_seconds: DEFAULT_STALE_SECONDS });
  });

  it('throws repository-scoped RPC errors without mutating normalized rows', async () => {
    const client = createRecordingSupabaseJobsClient({
      rpcErrors: { complete_background_job: { message: 'permission denied' } },
    });
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'scan', {});
    await repo.claimNext('worker-a');

    await expect(repo.complete(job.jobId, 'worker-a', {})).rejects.toThrow(
      'BackgroundJobsRepository.complete failed: permission denied',
    );
    expect(normalizeJobRow(client.rows.get(job.jobId)).status).toBe('running');
  });

  it('throws lost-lease when RPC returns no owned running row', async () => {
    const client = createRecordingSupabaseJobsClient();
    const repo = new BackgroundJobsRepository({ client });
    const job = await repo.enqueue('tenant-a', 'scan', {});
    await repo.claimNext('worker-a');

    await expect(repo.complete(job.jobId, 'worker-b', {})).rejects.toThrow(
      `BackgroundJobsRepository.complete lost lease for job ${job.jobId} (worker worker-b)`,
    );
    await expect(repo.fail(job.jobId, 'worker-b', 'nope', DEFAULT_BACKOFF_SECONDS)).rejects.toThrow(
      'lost lease',
    );
  });

  it('rejects invalid job types and statuses at the repository boundary', async () => {
    const repo = new BackgroundJobsRepository({ client: createRecordingSupabaseJobsClient() });
    await expect(repo.enqueue('tenant-a', 'unknown', {})).rejects.toThrow('Invalid job type');
    expect(normalizeJobRow(undefined)).toBeNull();
  });
});
