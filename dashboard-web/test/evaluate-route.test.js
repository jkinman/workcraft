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

describe('POST /api/evaluate', () => {
  beforeEach(() => {
    mockGetTenantServices.mockReset();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.resetModules();
  });

  function baseServices(overrides = {}) {
    return {
      setup: {
        requireScanReady: () => ({ success: true, status: { ready: { scan: true } } }),
        ...overrides.setup,
      },
      runner: {
        runEvaluation: vi.fn(async () => ({
          mode: 'local-inline',
          status: 'completed',
          success: true,
          company: 'Acme Corp',
          role: 'Staff Engineer',
          score: 4.2,
        })),
        ...overrides.runner,
      },
      ...overrides,
    };
  }

  it('returns 200 for local inline evaluation success', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'local-dev' },
      services: baseServices(),
    });

    const { POST } = await loadRoute('../app/api/evaluate/route.js');
    const response = await POST(jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: { jdText: 'A'.repeat(80), notes: 'route test' },
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.mode).toBe('local-inline');
    expect(json.company).toBe('Acme Corp');
  });

  it('returns 202 with poll URL for hosted evaluation enqueue', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'hosted' },
      services: baseServices({
        runner: {
          runEvaluation: vi.fn(async () => ({
            mode: 'hosted-job',
            jobId: VALID_JOB_ID,
            status: 'queued',
            jobType: 'evaluation',
            pollUrl: `/api/jobs/${VALID_JOB_ID}`,
          })),
        },
      }),
    });

    const { POST } = await loadRoute('../app/api/evaluate/route.js');
    const response = await POST(jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: { jdText: 'B'.repeat(80) },
    }));
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.mode).toBe('hosted-job');
    expect(json.pollUrl).toBe(`/api/jobs/${VALID_JOB_ID}`);
  });

  it('returns 400 when setup is incomplete', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'local-dev' },
      services: baseServices({
        setup: {
          requireScanReady: () => ({
            success: false,
            code: 'setup_required',
            error: 'Scanner setup is incomplete',
            missing: ['portals', 'pipeline'],
          }),
        },
      }),
    });

    const { POST } = await loadRoute('../app/api/evaluate/route.js');
    const response = await POST(jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: { jdText: 'C'.repeat(80) },
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('setup_required');
    expect(json.missing).toEqual(['portals', 'pipeline']);
  });

  it('returns 400 when runner reports validation failure', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'local-dev' },
      services: baseServices({
        runner: {
          runEvaluation: vi.fn(async () => ({
            success: false,
            error: 'Provide a job posting URL or at least 80 characters of JD text',
          })),
        },
      }),
    });

    const { POST } = await loadRoute('../app/api/evaluate/route.js');
    const response = await POST(jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: {},
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/80 characters/i);
  });

  it('translates thrown runner errors into 400 responses', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'local-dev' },
      services: baseServices({
        runner: {
          runEvaluation: vi.fn(async () => {
            throw new Error('Invalid evaluation payload');
          }),
        },
      }),
    });

    const { POST } = await loadRoute('../app/api/evaluate/route.js');
    const response = await POST(jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: { url: 'not-a-url' },
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid evaluation payload');
  });

  it('supports hosted enqueue then poll via job status route', async () => {
    const jobs = createInMemoryJobsRepository();
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'hosted' },
      services: baseServices({
        jobs,
        runner: {
          runEvaluation: vi.fn(async (payload) => {
            const job = await jobs.enqueue('tenant-a', 'evaluation', payload);
            return {
              mode: 'hosted-job',
              jobId: job.jobId,
              status: job.status,
              jobType: job.jobType,
              pollUrl: job.pollUrl,
            };
          }),
        },
      }),
    });

    const { POST } = await loadRoute('../app/api/evaluate/route.js');
    const enqueueResponse = await POST(jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: { jdText: 'H'.repeat(80) },
    }));
    const enqueueJson = await enqueueResponse.json();

    expect(enqueueResponse.status).toBe(202);
    expect(enqueueJson.pollUrl).toMatch(/^\/api\/jobs\//);

    const { GET } = await loadRoute('../app/api/jobs/[jobId]/route.js');
    const pollResponse = await GET(
      jsonRequest(`http://localhost${enqueueJson.pollUrl}`),
      { params: Promise.resolve({ jobId: enqueueJson.jobId }) },
    );
    const pollJson = await pollResponse.json();

    expect(pollResponse.status).toBe(200);
    expect(pollJson.success).toBe(true);
    expect(pollJson.jobId).toBe(enqueueJson.jobId);
    expect(pollJson.status).toBe('queued');
    expect(pollJson.payload.jdText).toHaveLength(80);
  });

  it('propagates missing auth/tenant resolution failures', async () => {
    stubAuthFailure('Authentication required for hosted tenant resolution');

    const { POST } = await loadRoute('../app/api/evaluate/route.js');
    const request = jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: { jdText: 'D'.repeat(80) },
      tenantId: null,
    });

    await expect(POST(request)).rejects.toThrow('Authentication required for hosted tenant resolution');
  });

  it('reuses tenant services for the same request object', async () => {
    stubTenantScope({
      tenant: { tenantId: 'tenant-a', mode: 'local-dev' },
      services: baseServices(),
    });

    const request = jsonRequest('http://localhost/api/evaluate', {
      method: 'POST',
      body: { jdText: 'E'.repeat(80) },
    });
    await mockGetTenantServices(request);
    await mockGetTenantServices(request);

    expect(mockGetTenantServices).toHaveBeenCalledTimes(2);
    expect(request._tenantScope.tenant.tenantId).toBe('tenant-a');
  });
});
