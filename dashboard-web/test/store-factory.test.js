import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CareerOpsDataClient } from '../lib/data/career-ops-data-client';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import { createCareerOpsObjectStore, createCareerOpsStore, storageAdapterFromEnv } from '../lib/stores/store-factory';
import { SupabaseCareerOpsStore } from '../lib/stores/supabase-career-ops-store';
import { SupabaseObjectStore } from '../lib/stores/supabase-object-store';
import { requireSupabaseConfig } from '../lib/stores/supabase-client';

function makeDataClient() {
  const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-store-'));
  const repository = new LocalCareerOpsRepository({ tenantId: 'tenant-a', rootPath });
  return new CareerOpsDataClient(repository);
}

describe('career-ops store adapters', () => {
  it('uses local storage by default', () => {
    expect(storageAdapterFromEnv({})).toBe('local');

    const dataClient = makeDataClient();
    const store = createCareerOpsStore({ dataClient, tenantContext: { tenantId: 'tenant-a' }, env: {} });

    store.writeProfile('candidate:\n  full_name: Test User\n');
    store.writePipeline('# Pipeline\n');
    store.writeEvaluation('001-acme.md', '# Acme\n');

    expect(store.adapter).toBe('local');
    expect(store.readProfile()).toContain('Test User');
    expect(store.readPipeline()).toContain('# Pipeline');
    expect(store.listEvaluations().map(report => report.filename)).toEqual(['001-acme.md']);
  });

  it('stores local generated objects through the object-store contract', async () => {
    const dataClient = makeDataClient();
    const objectStore = createCareerOpsObjectStore({ dataClient, tenantContext: { tenantId: 'tenant-a' }, env: {} });

    const metadata = await objectStore.putObject({
      key: 'cv-test-user-acme.pdf',
      content: Buffer.from('pdf'),
      contentType: 'application/pdf',
      metadata: { type: 'resume' }
    });
    const object = objectStore.getObject('cv-test-user-acme.pdf');

    expect(metadata).toMatchObject({
      key: 'cv-test-user-acme.pdf',
      contentType: 'application/pdf',
      storage: 'local'
    });
    expect(object.content.toString()).toBe('pdf');
    expect(objectStore.getSignedUrl('cv-test-user-acme.pdf')).toBe('/download-pdf?file=cv-test-user-acme.pdf');
  });

  it('selects Supabase storage in hosted mode or explicit adapter mode', () => {
    expect(storageAdapterFromEnv({ CAREER_OPS_TENANT_MODE: 'hosted' })).toBe('supabase');
    expect(storageAdapterFromEnv({ CAREER_OPS_STORAGE_ADAPTER: 'supabase' })).toBe('supabase');
    expect(() => storageAdapterFromEnv({ CAREER_OPS_STORAGE_ADAPTER: 'unknown' })).toThrow('Unsupported CAREER_OPS_STORAGE_ADAPTER');

    const env = {
      CAREER_OPS_STORAGE_ADAPTER: 'supabase',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
    };
    const store = createCareerOpsStore({
      dataClient: makeDataClient(),
      tenantContext: { tenantId: 'tenant-a' },
      env
    });

    expect(store.constructor.name).toBe('SupabaseCareerOpsStore');
    expect(() => store.readProfile()).toThrow('SupabaseCareerOpsStore.readProfile is not implemented yet');
  });

  it('requires Supabase server credentials for the Supabase adapter', () => {
    expect(() => requireSupabaseConfig({})).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  });

  it('scopes Supabase object keys by tenant', async () => {
    const uploaded = [];
    const fakeClient = {
      storage: {
        from: bucket => ({
          upload: async (key, content, options) => {
            uploaded.push({ bucket, key, content, options });
            return { error: null };
          },
          download: async key => ({ data: Buffer.from(key), error: null }),
          createSignedUrl: async key => ({ data: { signedUrl: `signed:${key}` }, error: null })
        })
      }
    };
    const objectStore = new SupabaseObjectStore({
      tenantId: 'tenant-a',
      bucket: 'career-ops-files',
      client: fakeClient
    });

    const result = await objectStore.putObject({
      key: 'cv-test-user-acme.pdf',
      content: Buffer.from('pdf'),
      contentType: 'application/pdf'
    });

    expect(result).toMatchObject({
      key: 'users/tenant-a/cv-test-user-acme.pdf',
      bucket: 'career-ops-files',
      storage: 'supabase'
    });
    expect(uploaded[0].key).toBe('users/tenant-a/cv-test-user-acme.pdf');
    await expect(objectStore.getSignedUrl('cv-test-user-acme.pdf')).resolves.toBe('signed:users/tenant-a/cv-test-user-acme.pdf');
  });

  it('keeps the Supabase career store schema placeholder behind the contract', () => {
    const store = new SupabaseCareerOpsStore({ tenantId: 'tenant-a', client: {} });

    expect(store.adapter).toBe('supabase');
    expect(() => store.writePipeline('# Pipeline')).toThrow('Create schema tables before enabling this operation');
  });
});
