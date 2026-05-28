import { describe, expect, it } from 'vitest';
import workloadRunner from '../lib/services/workload-runner';

const { createHostedWorkloadRunner, parseMetric } = workloadRunner;

describe('workload runner', () => {
  it('parses legacy scan metrics behind the local adapter seam', () => {
    expect(parseMetric('Companies scanned: 12\nNew offers added: 3', /Companies scanned:\s+(\d+)/)).toBe(12);
  });

  it('queues scan work in hosted mode instead of spawning local commands', async () => {
    const runner = createHostedWorkloadRunner({ tenantId: 'user_123', mode: 'hosted' });

    await expect(runner.runScan({ dryRun: true })).resolves.toMatchObject({
      mode: 'hosted-job',
      status: 'queued',
      jobType: 'scan',
      tenantId: 'user_123',
      options: { dryRun: true }
    });
  });

  it('queues PDF work in hosted mode', async () => {
    const runner = createHostedWorkloadRunner({ tenantId: 'user_123', mode: 'hosted' });

    await expect(runner.enqueuePdf({ type: 'resume' })).resolves.toMatchObject({
      mode: 'hosted-job',
      status: 'queued',
      jobType: 'pdf',
      tenantId: 'user_123',
      payload: { type: 'resume' }
    });
  });
});
