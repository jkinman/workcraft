import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { executeJob } from '../lib/worker/job-executor';
import { materializeTenantForScan, syncScanArtifacts } from '../lib/worker/tenant-materializer';

function makeFakeTenantClient(documents) {
  return {
    from(table) {
      if (table !== 'tenant_documents') throw new Error(`Unexpected table: ${table}`);
      return {
        select() {
          return {
            eq(_column, tenantId) {
              const rows = documents.filter(row => row.tenant_id === tenantId);
              return Promise.resolve({ data: rows, error: null });
            }
          };
        },
        upsert(row) {
          const index = documents.findIndex(doc => doc.tenant_id === row.tenant_id && doc.path === row.path);
          if (index === -1) documents.push(row);
          else documents[index] = row;
          return Promise.resolve({ error: null });
        }
      };
    }
  };
}

describe('tenant materializer', () => {
  it('materializes scan inputs and syncs mutated artifacts back', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'career-ops-materialize-'));
    const documents = [
      {
        tenant_id: 'tenant-a',
        path: 'portals.yml',
        content: 'tracked_companies: []\n'
      },
      {
        tenant_id: 'tenant-a',
        path: 'data/pipeline.md',
        content: '# Pipeline\n\n## Pending\n'
      }
    ];
    const client = makeFakeTenantClient(documents);

    await materializeTenantForScan('tenant-a', client, tempRoot);
    expect(readFileSync(join(tempRoot, 'portals.yml'), 'utf8')).toContain('tracked_companies');

    writeFileSync(join(tempRoot, 'data/pipeline.md'), '# Pipeline\n\n## Pending\n- [ ] https://example.com/job | Acme | Engineer\n');
    writeFileSync(join(tempRoot, 'data/scan-history.tsv'), 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n');

    await syncScanArtifacts('tenant-a', client, tempRoot);

    expect(documents.find(doc => doc.path === 'data/pipeline.md')?.content).toContain('example.com/job');
    expect(documents.find(doc => doc.path === 'data/scan-history.tsv')?.content).toContain('url\tfirst_seen');
  });
});

describe('job executor dispatch', () => {
  it('returns null for empty jobs and rejects unknown types', async () => {
    await expect(executeJob(null)).resolves.toBeNull();
    await expect(executeJob({ jobType: 'unknown' })).rejects.toThrow('Unsupported job type');
  });
});
