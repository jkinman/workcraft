import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('tenant Supabase client composition', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.CAREER_OPS_TENANT_MODE = 'hosted';
  });

  it('fails closed in hosted production when Supabase JWT is missing', async () => {
    const { resolveTenantSupabaseClient } = await import('../lib/auth/supabase-session');
    const tenant = { tenantId: 'tenant-a', tenantSource: 'auth', mode: 'hosted' };
    expect(() => resolveTenantSupabaseClient({}, tenant, { NODE_ENV: 'production' }))
      .toThrow(/Supabase tenant JWT required/);
  });

  it('creates tenant user client and blocks service role in ordinary request path', async () => {
    const {
      createSupabaseUserClient,
      createSupabaseServerClient,
      assertServiceRoleAllowed,
    } = await import('../lib/repositories/supabase-client');

    const jwt = `hdr.${Buffer.from(JSON.stringify({ tenant_id: 'tenant-a', sub: 'user_a' })).toString('base64url')}.sig`;
    const userClient = createSupabaseUserClient(jwt);
    expect(() => assertServiceRoleAllowed(userClient, { context: 'GET /api/llm-usage' }))
      .not.toThrow();

    const serviceClient = createSupabaseServerClient();
    expect(() => assertServiceRoleAllowed(serviceClient, { context: 'GET /api/llm-usage' }))
      .toThrow(/Service-role Supabase client blocked/);
  });

  it('reuses one request-scoped Supabase user client for services composition', async () => {
    const tenantServices = await import('../lib/tenant-services');
    const { createCareerOpsServices } = await import('../lib/services/dashboard-service');

    const fakeClient = {
      from() {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          upsert: () => Promise.resolve({ error: null }),
        };
      },
      storage: {
        from: () => ({
          list: async () => ({ data: [], error: null }),
          download: async () => ({ data: null, error: { message: 'missing' } }),
          upload: async () => ({ error: null }),
          createSignedUrl: async () => ({ data: { signedUrl: 'signed:test' }, error: null }),
        }),
      },
    };

    const request = new Request('http://localhost/api/test');
    const tenant = {
      tenantId: 'tenant-a',
      tenantSource: 'auth',
      mode: 'hosted',
      supabaseJwt: 'fake-jwt',
      supabaseClient: fakeClient,
      env: process.env,
    };

    const services1 = await tenantServices.resolveTenantServices(request, tenant);
    const services2 = await tenantServices.resolveTenantServices(request, tenant);
    expect(services1).toBe(services2);
    expect(services1.repository.storageAdapter).toBe('supabase');
    expect(services1.jobs.client).toBe(fakeClient);
    expect(services1.repository.client).toBe(fakeClient);

    await expect(createCareerOpsServices({ mode: 'hosted', tenantId: 'tenant-a' }))
      .rejects.toThrow(/tenantContext\.supabaseClient|tenant-scoped Supabase client/);
  });

  it('rejects BackgroundJobsRepository without injected client for tenant requests', async () => {
    const { createBackgroundJobsRepository, createWorkerBackgroundJobsRepository } = await import('../lib/repositories/background-jobs-repository');
    expect(() => createBackgroundJobsRepository()).toThrow(/requires an injected Supabase client/);
    expect(createWorkerBackgroundJobsRepository({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    }).allowServiceRole).toBe(true);
  });
});
