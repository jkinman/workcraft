import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CareerOpsDataClient } from '../lib/data/career-ops-data-client';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import { SupabaseRepository } from '../lib/repositories/supabase-repository';
import { tenantStorageKey } from '../lib/repositories/storage-keys';
import { requireSupabaseConfig } from '../lib/repositories/supabase-client';

function makeFakeSupabaseClient({ documents = [], storage = {} } = {}) {
  const docRows = new Map(documents.map(row => [row.path, row]));
  const uploads = [];
  const downloads = new Map(Object.entries(storage));

  return {
    uploads,
    from(table) {
      if (table !== 'tenant_documents') throw new Error(`Unexpected table: ${table}`);
      return {
        select() {
          return {
            eq(_column, tenantId) {
              const rows = [...docRows.values()].filter(row => row.tenant_id === tenantId);
              return Promise.resolve({ data: rows, error: null });
            }
          };
        },
        upsert(row) {
          docRows.set(row.path, row);
          return Promise.resolve({ error: null });
        }
      };
    },
    storage: {
      from(bucket) {
        return {
          upload: async (key, content, options) => {
            uploads.push({ bucket, key, content, options });
            downloads.set(key, Buffer.from(content));
            return { error: null };
          },
          download: async key => {
            if (!downloads.has(key)) return { data: null, error: new Error('missing') };
            return {
              data: {
                async arrayBuffer() {
                  return downloads.get(key);
                }
              },
              error: null
            };
          },
          list: async prefix => ({
            data: [...downloads.keys()]
              .filter(key => key.startsWith(`${prefix}/`))
              .map(key => ({
                name: key.slice(prefix.length + 1),
                updated_at: '2026-05-25T00:00:00.000Z',
                metadata: { size: downloads.get(key).length }
              })),
            error: null
          }),
          createSignedUrl: async key => ({ data: { signedUrl: `signed:${key}` }, error: null })
        };
      }
    }
  };
}

async function runRepositoryContract(repository) {
  const client = new CareerOpsDataClient(repository);

  await client.writeProfile('candidate:\n  full_name: Contract User\n');
  await client.writeAgentProfile('# Strategy\n');
  await client.writePipeline('# Pipeline\n');
  await client.writeReport('001-acme.md', '# Report\n');

  expect(client.readProfile()).toContain('Contract User');
  expect(client.readAgentProfile()).toContain('# Strategy');
  expect(client.readPipeline()).toContain('# Pipeline');
  expect(client.listReports().map(report => report.filename)).toEqual(['001-acme.md']);

  await client.writeOutputFile('cv-contract-acme.pdf', Buffer.from('pdf-bytes'));
  expect((await client.readOutputFile('cv-contract-acme.pdf')).toString()).toBe('pdf-bytes');
  expect((await client.listGeneratedFiles()).map(file => file.filename)).toEqual(['cv-contract-acme.pdf']);
}

describe('repository contract', () => {
  it('uses tenant-relative storage keys', () => {
    expect(tenantStorageKey('tenant-a', 'output/cv.pdf')).toBe('tenant-a/output/cv.pdf');
  });

  it('requires Supabase server credentials when creating the default client', () => {
    expect(() => requireSupabaseConfig({})).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  });

  it('runs shared data-client behaviors against the local repository', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-contract-'));
    const repository = new LocalCareerOpsRepository({ tenantId: 'tenant-a', rootPath });
    await runRepositoryContract(repository);
  });

  it('runs shared data-client behaviors against a fake Supabase repository', async () => {
    const client = makeFakeSupabaseClient();
    const repository = new SupabaseRepository({ tenantId: 'tenant-a', client, env: {} });
    await repository.initialize();
    await runRepositoryContract(repository);

    expect(repository.storageAdapter).toBe('supabase');
    expect(client.uploads[0].key).toBe('tenant-a/output/cv-contract-acme.pdf');
  });

  it('lists and downloads hosted output files from storage', async () => {
    const client = makeFakeSupabaseClient({
      storage: {
        'tenant-a/output/cv-hosted.pdf': Buffer.from('hosted-pdf')
      }
    });
    const repository = new SupabaseRepository({ tenantId: 'tenant-a', client, env: {} });
    await repository.initialize();
    const dataClient = new CareerOpsDataClient(repository);

    expect(await dataClient.readOutputFile('cv-hosted.pdf')).toEqual(Buffer.from('hosted-pdf'));
    expect((await dataClient.listGeneratedFiles()).map(file => file.filename)).toEqual(['cv-hosted.pdf']);
    await expect(repository.getSignedUrl('output/cv-hosted.pdf')).resolves.toBe('signed:tenant-a/output/cv-hosted.pdf');
  });
});
