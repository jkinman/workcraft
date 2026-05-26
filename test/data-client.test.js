import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import { CareerOpsDataClient } from '../lib/data/career-ops-data-client';

function makeClient() {
  const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-data-client-'));
  const repository = new LocalCareerOpsRepository({ tenantId: 'tenant-a', rootPath });
  return { client: new CareerOpsDataClient(repository), rootPath };
}

describe('CareerOpsDataClient', () => {
  it('maps user-layer files into a tenant root', () => {
    const { client, rootPath } = makeClient();

    client.writeProfile('candidate:\n  full_name: Test User\n');
    client.writePipeline('# Pipeline\n');
    client.writeReport('001-acme.md', '# Evaluation: Acme - Engineer\n');
    client.writeOutputFile('cv-test-user-acme-2026-05-25.pdf', Buffer.from('pdf'));

    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'config', 'profile.yml'), 'utf8')).toContain('Test User');
    expect(client.readPipeline()).toContain('# Pipeline');
    expect(client.listReports().map(report => report.filename)).toEqual(['001-acme.md']);
    expect(client.readOutputFile('cv-test-user-acme-2026-05-25.pdf').toString()).toBe('pdf');
  });

  it('returns null for missing optional user files', () => {
    const { client } = makeClient();

    expect(client.readCv()).toBeNull();
    expect(client.readArticleDigest()).toBeNull();
    expect(client.readStoryBank()).toBeNull();
  });
});
