import { describe, expect, it } from 'vitest';
import workloadRunner from '../lib/services/workload-runner';

const { createHostedWorkloadRunner, parseMetric } = workloadRunner;

function makeFakeJobsRepository() {
  const jobs = new Map();
  let seq = 0;

  return {
    async enqueue(tenantId, jobType, payload) {
      const jobId = `job-${++seq}`;
      const job = {
        jobId,
        tenantId,
        jobType,
        status: 'queued',
        payload,
        pollUrl: `/api/jobs/${jobId}`
      };
      jobs.set(jobId, job);
      return job;
    }
  };
}

describe('workload runner', () => {
  it('parses legacy scan metrics behind the local adapter seam', () => {
    expect(parseMetric('Companies scanned: 12\nNew offers added: 3', /Companies scanned:\s+(\d+)/)).toBe(12);
  });

  it('queues scan work in hosted mode with persisted job ids', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'user_123', mode: 'hosted' }, jobsRepository);

    await expect(runner.runScan({ dryRun: true })).resolves.toMatchObject({
      mode: 'hosted-job',
      status: 'queued',
      jobType: 'scan',
      jobId: 'job-1',
      pollUrl: '/api/jobs/job-1'
    });
  });

  it('queues PDF work in hosted mode with persisted job ids', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'user_123', mode: 'hosted' }, jobsRepository);

    await expect(runner.enqueuePdf({ kind: 'resume', company: 'Acme', role: 'Engineer' })).resolves.toMatchObject({
      mode: 'hosted-job',
      status: 'queued',
      jobType: 'pdf',
      jobId: 'job-1',
      pollUrl: '/api/jobs/job-1'
    });
  });
});
