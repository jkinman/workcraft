import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getSupabaseInitializeCount,
  resetSupabaseInitializeCount,
} from '../lib/repositories/repository-factory';
import { createCareerOpsServices } from '../lib/services/dashboard-service';
import { getTenantServices } from '../lib/tenant-services';

describe('tenant services request scope', () => {
  afterEach(() => {
    resetSupabaseInitializeCount();
    delete process.env.CAREER_OPS_TENANT_MODE;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('reuses one service graph per request object', async () => {
    const request = new Request('http://localhost/api/queue', {
      headers: { 'x-tenant-id': 'tenant-a' },
    });

    const first = await getTenantServices(request);
    const second = await getTenantServices(request);

    expect(first.services).toBe(second.services);
  });

  it('reuses one service graph for concurrent calls on the same request object', async () => {
    const request = new Request('http://localhost/api/queue', {
      headers: { 'x-tenant-id': 'tenant-a' },
    });

    const [first, second, third] = await Promise.all([
      getTenantServices(request),
      getTenantServices(request),
      getTenantServices(request),
    ]);

    expect(first.services).toBe(second.services);
    expect(second.services).toBe(third.services);
  });

  it('counts Supabase repository initialization through createRepository', async () => {
    resetSupabaseInitializeCount();

    const fakeClient = {
      from(table) {
        if (table !== 'tenant_documents') throw new Error(`Unexpected table ${table}`);
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
        };
      },
    };

    const { createRepository, getSupabaseInitializeCount: countInit } = await import('../lib/repositories/repository-factory');
    const { SupabaseRepository } = await import('../lib/repositories/supabase-repository');

    await createRepository({ mode: 'hosted', tenantId: 'tenant-a', supabaseClient: fakeClient });
    await createRepository({ mode: 'hosted', tenantId: 'tenant-b', supabaseClient: fakeClient });
    expect(countInit()).toBe(2);

    const repo = new SupabaseRepository({ tenantId: 'tenant-c', client: fakeClient, env: {} });
    await repo.initialize();
    expect(repo.readText('missing')).toBeNull();
  });
});

describe('cross-tenant separation', () => {
  it('writes pipeline entries into isolated tenant directories', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'co-tenant-scope-'));
    process.env.CAREER_OPS_PATH = rootPath;
    process.env.CAREER_OPS_TENANT_MODE = 'local-dev';

    const tenantAData = join(rootPath, 'tenants', 'tenant-a', 'data');
    const tenantBData = join(rootPath, 'tenants', 'tenant-b', 'data');
    mkdirSync(tenantAData, { recursive: true });
    mkdirSync(tenantBData, { recursive: true });
    writeFileSync(join(tenantAData, 'pipeline.md'), '# Pipeline\n\n## Pending\n');
    writeFileSync(join(tenantBData, 'pipeline.md'), '# Pipeline\n\n## Pending\n');

    const servicesA = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'tenant-a' });
    const servicesB = await createCareerOpsServices({ mode: 'local-dev', tenantId: 'tenant-b' });

    await servicesA.pipeline.add('https://jobs.example.com/a', 'Acme | Engineer');
    await servicesB.pipeline.add('https://jobs.example.com/b', 'Beta | PM');

    expect(readFileSync(join(tenantAData, 'pipeline.md'), 'utf8')).toContain('Acme | Engineer');
    expect(readFileSync(join(tenantBData, 'pipeline.md'), 'utf8')).toContain('Beta | PM');
    expect(readFileSync(join(tenantAData, 'pipeline.md'), 'utf8')).not.toContain('Beta | PM');
  });
});
