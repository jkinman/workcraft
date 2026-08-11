import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const schemaPath = join(import.meta.dirname, '..', 'supabase', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf8');

describe('RLS policy static contracts', () => {
  it('defines auth_tenant_id helper for Clerk JWT tenant claim', () => {
    expect(schema).toContain('create or replace function auth_tenant_id()');
    expect(schema).toMatch(/tenant_id/);
    expect(schema).toMatch(/request\.jwt\.claims/);
  });

  it('enables RLS on tenant_documents, background_jobs, and storage.objects policies', () => {
    expect(schema).toContain('alter table tenant_documents enable row level security');
    expect(schema).toContain('alter table background_jobs enable row level security');
    expect(schema).toContain('create policy tenant_documents_tenant_select');
    expect(schema).toContain('create policy background_jobs_tenant_select');
    expect(schema).toContain('create policy storage_objects_tenant_select');
  });

  it('restricts background_jobs tenant policies to select/insert only', () => {
    expect(schema).toContain('create policy background_jobs_tenant_select');
    expect(schema).toContain('create policy background_jobs_tenant_insert');
    expect(schema).not.toMatch(/create policy background_jobs_tenant_update/);
    expect(schema).not.toMatch(/create policy background_jobs_tenant_delete/);
  });

  it('revokes worker RPC execute from public/anon/authenticated and grants service_role only', () => {
    expect(schema).toMatch(/revoke execute on function claim_next_background_job[\s\S]*from public, anon, authenticated/);
    expect(schema).toMatch(/grant execute on function claim_next_background_job[\s\S]*to service_role/);
    expect(schema).toMatch(/revoke execute on function complete_background_job[\s\S]*from public, anon, authenticated/);
  });

  it('uses heartbeat-aware stale reclaim via coalesce(heartbeat_at, claimed_at)', () => {
    expect(schema).toMatch(/coalesce\(heartbeat_at, claimed_at\)/);
  });

  it('defines worker RPCs for lease renewal, fail/retry, and dead-letter', () => {
    expect(schema).toContain('renew_job_lease');
    expect(schema).toContain('fail_background_job');
    expect(schema).toContain('dead_letter');
    expect(schema).toContain('upsert_worker_heartbeat');
  });

  it('documents idempotency unique index per tenant', () => {
    expect(schema).toContain('background_jobs_tenant_idempotency');
    expect(schema).toContain('idempotency_key');
  });
});

describe('RLS integration-fake cross-tenant denial', () => {
  function makeRlsStore() {
    const docs = new Map();
    const jobs = new Map();
    const storage = new Map();

    function tenantFromJwt(jwt) {
      if (!jwt) return null;
      try {
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
        return payload.tenant_id || payload.sub || null;
      } catch {
        return null;
      }
    }

    return {
      docs,
      jobs,
      storage,
      tenantFromJwt,
      selectDocs(jwt) {
        const tenant = tenantFromJwt(jwt);
        return [...docs.values()].filter((d) => d.tenant_id === tenant);
      },
      insertDoc(jwt, row) {
        const tenant = tenantFromJwt(jwt);
        if (row.tenant_id !== tenant) throw new Error('RLS denial: tenant mismatch on insert');
        docs.set(`${row.tenant_id}:${row.path}`, row);
        return row;
      },
      readDoc(jwt, tenantId, path) {
        const tenant = tenantFromJwt(jwt);
        if (tenantId !== tenant) return null;
        return docs.get(`${tenantId}:${path}`) ?? null;
      },
      getJob(jwt, tenantId, jobId) {
        const tenant = tenantFromJwt(jwt);
        const job = jobs.get(jobId);
        if (!job || job.tenant_id !== tenant) return null;
        return job;
      },
      download(jwt, key) {
        const tenant = tenantFromJwt(jwt);
        const prefix = `${tenant}/`;
        if (!key.startsWith(prefix)) throw new Error('RLS denial: storage prefix mismatch');
        return storage.get(key) ?? null;
      },
      upload(jwt, key, bytes) {
        const tenant = tenantFromJwt(jwt);
        if (!key.startsWith(`${tenant}/`)) throw new Error('RLS denial: storage prefix mismatch');
        storage.set(key, bytes);
      },
    };
  }

  it('denies cross-tenant document reads and storage downloads', () => {
    const store = makeRlsStore();
    const jwtA = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')
      + '.' + Buffer.from(JSON.stringify({ tenant_id: 'tenant-a', sub: 'user_a' })).toString('base64url')
      + '.sig';
    const jwtB = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')
      + '.' + Buffer.from(JSON.stringify({ tenant_id: 'tenant-b', sub: 'user_b' })).toString('base64url')
      + '.sig';

    store.insertDoc(jwtA, { tenant_id: 'tenant-a', path: 'cv.md', content: '# A' });
    store.upload(jwtA, 'tenant-a/output/cv-a.pdf', Buffer.from('pdf-a'));

    expect(store.readDoc(jwtA, 'tenant-a', 'cv.md')?.content).toContain('# A');
    expect(store.readDoc(jwtB, 'tenant-a', 'cv.md')).toBeNull();
    expect(store.download(jwtA, 'tenant-a/output/cv-a.pdf')?.toString()).toBe('pdf-a');
    expect(() => store.download(jwtB, 'tenant-a/output/cv-a.pdf')).toThrow(/RLS denial/);
  });

  it('denies cross-tenant job polling', () => {
    const store = makeRlsStore();
    const jwtA = 'hdr.' + Buffer.from(JSON.stringify({ tenant_id: 'tenant-a' })).toString('base64url') + '.sig';
    const jwtB = 'hdr.' + Buffer.from(JSON.stringify({ tenant_id: 'tenant-b' })).toString('base64url') + '.sig';
    store.jobs.set('job-1', { id: 'job-1', tenant_id: 'tenant-a', status: 'queued' });

    expect(store.getJob(jwtA, 'tenant-a', 'job-1')).toBeTruthy();
    expect(store.getJob(jwtB, 'tenant-a', 'job-1')).toBeNull();
  });
});

describe('service-role runtime guard', () => {
  it('blocks service-role client in tenant request context', async () => {
    const { assertServiceRoleAllowed, createSupabaseServerClient } = await import('../lib/repositories/supabase-client');
    const client = createSupabaseServerClient({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    });
    expect(() => assertServiceRoleAllowed(client, { context: 'GET /api/manage/profile' }))
      .toThrow(/Service-role Supabase client blocked/);
    expect(() => assertServiceRoleAllowed(client, { allowServiceRole: true, context: 'worker' }))
      .not.toThrow();
  });
});
