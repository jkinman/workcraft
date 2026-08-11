import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryJobsRepository } from './fakes/in-memory-jobs-repository';
import {
  jsonRequest,
  loadRoute,
  mockGetTenantServices,
  stubAuthFailure,
  stubTenantScope,
  VALID_JOB_ID,
} from './fakes/route-request-scope';

describe('GET /api/jobs/[jobId]', () => {
  beforeEach(() => {
    mockGetTenantServices.mockReset();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.resetModules();
  });

  function jobContext(jobId) {
    return { params: Promise.resolve({ jobId }) };
  }

  it('returns 404 for malformed job ids', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'hosted' },
      services: { jobs: createInMemoryJobsRepository() },
    });

    const { GET } = await loadRoute('../app/api/jobs/[jobId]/route.js');
    const response = await GET(
      jsonRequest('http://localhost/api/jobs/not-a-uuid'),
      jobContext('not-a-uuid'),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Job not found');
  });

  it('returns 404 when job polling is unavailable in local mode', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'local-dev' },
      services: {},
    });

    const { GET } = await loadRoute('../app/api/jobs/[jobId]/route.js');
    const response = await GET(
      jsonRequest(`http://localhost/api/jobs/${VALID_JOB_ID}`),
      jobContext(VALID_JOB_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Job status is unavailable in local mode');
  });

  it('returns 200 for a tenant-scoped hosted job', async () => {
    const jobs = createInMemoryJobsRepository();
    const queued = await jobs.enqueue('tenant-a', 'evaluation', { jdText: 'F'.repeat(80) });

    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'hosted' },
      services: { jobs },
    });

    const { GET } = await loadRoute('../app/api/jobs/[jobId]/route.js');
    const response = await GET(
      jsonRequest(`http://localhost/api/jobs/${queued.jobId}`),
      jobContext(queued.jobId),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.jobId).toBe(queued.jobId);
    expect(json.tenantId).toBe('tenant-a');
    expect(json.jobType).toBe('evaluation');
    expect(json.status).toBe('queued');
  });

  it('returns 404 when the job belongs to another tenant', async () => {
    const jobs = createInMemoryJobsRepository();
    const queued = await jobs.enqueue('tenant-a', 'evaluation', { jdText: 'G'.repeat(80) });

    stubTenantScope({
      tenant: { tenantId: 'tenant-b', mode: 'hosted' },
      services: { jobs },
    });

    const { GET } = await loadRoute('../app/api/jobs/[jobId]/route.js');
    const response = await GET(
      jsonRequest(`http://localhost/api/jobs/${queued.jobId}`, { tenantId: 'tenant-b' }),
      jobContext(queued.jobId),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Job not found');
  });

  it('returns 404 for unknown job ids within the tenant scope', async () => {
    const jobs = createInMemoryJobsRepository();

    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'hosted' },
      services: { jobs },
    });

    const { GET } = await loadRoute('../app/api/jobs/[jobId]/route.js');
    const response = await GET(
      jsonRequest(`http://localhost/api/jobs/${VALID_JOB_ID}`),
      jobContext(VALID_JOB_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Job not found');
  });

  it('propagates missing auth/tenant resolution failures', async () => {
    stubAuthFailure('Supabase tenant JWT required for hosted requests');

    const { GET } = await loadRoute('../app/api/jobs/[jobId]/route.js');
    const request = jsonRequest(`http://localhost/api/jobs/${VALID_JOB_ID}`, { tenantId: null });

    await expect(GET(request, jobContext(VALID_JOB_ID))).rejects.toThrow(
      'Supabase tenant JWT required for hosted requests',
    );
  });
});
