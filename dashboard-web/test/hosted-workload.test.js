import { describe, expect, it, vi } from 'vitest';
import pdfRoute from '../lib/api/pdf-route';
import workloadRunner from '../lib/services/workload-runner';

const { handleHostedOrInlinePdf, isHostedJobResult } = pdfRoute;
const { createHostedWorkloadRunner } = workloadRunner;

function makeFakeJobsRepository() {
  const jobs = new Map();
  let seq = 0;

  return {
    jobs,
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
    },
    async getForTenant(tenantId, jobId) {
      const job = jobs.get(jobId);
      if (!job || job.tenantId !== tenantId) return null;
      return job;
    }
  };
}

function jsonRequest(body) {
  return new Request('http://localhost/api/generate-resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('hosted workload branching', () => {
  it('detects hosted scan responses for 202 branching', () => {
    expect(isHostedJobResult({
      mode: 'hosted-job',
      jobId: 'job-1',
      pollUrl: '/api/jobs/job-1'
    })).toBe(true);
    expect(isHostedJobResult({ mode: 'local-cli', status: 'completed' })).toBe(false);
  });

  it('returns 202 for hosted pdf without invoking inline generator', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'tenant-a', mode: 'hosted' }, jobsRepository);
    const services = { runner, dataClient: {}, reports: {} };
    const tenant = { mode: 'hosted', tenantId: 'tenant-a' };

    const response = await handleHostedOrInlinePdf(jsonRequest({ company: 'Acme', role: 'Engineer' }), services, tenant, {
      buildPayload(body) {
        return {
          kind: 'resume',
          company: body.company,
          role: body.role,
          jobDescription: ''
        };
      },
      runInline: vi.fn(() => {
        throw new Error('generator should not run in hosted mode');
      })
    });

    const json = await response.json();
    expect(response.status).toBe(202);
    expect(json).toMatchObject({
      success: true,
      mode: 'hosted-job',
      jobType: 'pdf',
      pollUrl: '/api/jobs/job-1'
    });
    expect([...jobsRepository.jobs.values()][0].payload).toEqual({
      kind: 'resume',
      company: 'Acme',
      role: 'Engineer',
      jobDescription: ''
    });
  });

  it('runs inline generator in local mode', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const runner = createHostedWorkloadRunner({ tenantId: 'tenant-a', mode: 'hosted' }, jobsRepository);
    const services = { runner, dataClient: {}, reports: {} };
    const tenant = { mode: 'local-dev', tenantId: 'tenant-a' };
    const runInline = vi.fn(async () => ({ success: true, downloadUrl: '/download-pdf?file=cv.pdf' }));

    const response = await handleHostedOrInlinePdf(jsonRequest({ company: 'Acme', role: 'Engineer' }), services, tenant, {
      buildPayload(body) {
        return { kind: 'resume', company: body.company, role: body.role, jobDescription: '' };
      },
      runInline
    });

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(runInline).toHaveBeenCalledOnce();
    expect(jobsRepository.jobs.size).toBe(0);
  });

  it('enforces tenant isolation for job polling lookups', async () => {
    const jobsRepository = makeFakeJobsRepository();
    const created = await jobsRepository.enqueue('tenant-a', 'scan', { dryRun: true });

    await expect(jobsRepository.getForTenant('tenant-a', created.jobId)).resolves.toMatchObject({ jobId: created.jobId });
    await expect(jobsRepository.getForTenant('tenant-b', created.jobId)).resolves.toBeNull();
  });
});
