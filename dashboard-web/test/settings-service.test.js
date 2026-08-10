import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import { CareerOpsDataClient } from '../lib/data/career-ops-data-client';
import { createSettingsService } from '../lib/services/settings-service';

function makeService() {
  const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-settings-'));
  const repository = new LocalCareerOpsRepository({ tenantId: 'tenant-a', rootPath });
  const dataClient = new CareerOpsDataClient(repository);
  return { service: createSettingsService(dataClient), rootPath, dataClient };
}

const RESUME_MD = `# Jane Smith
## ML Engineer

### Summary
Builder of production AI systems.

### Skills
- **Backend (90/100):** Node, Python

### Experience
**Acme** | Staff Engineer | 2020-2024
*Led platform team*
- Shipped agentic workflows
`;

describe('settings service', () => {
  it('saves valid profile YAML through the data client', async () => {
    const { service, rootPath } = makeService();

    const result = await service.saveProfile('candidate:\n  full_name: Jane Smith\n');

    expect(result.saved).toBe(true);
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'config', 'profile.yml'), 'utf8')).toContain('Jane Smith');
    expect(service.getProfile().content).toContain('Jane Smith');
  });

  it('rejects invalid profile YAML and does not write', async () => {
    const { service, dataClient } = makeService();

    await expect(service.saveProfile('candidate:\n  full_name: "unterminated')).rejects.toThrow('Invalid profile YAML');
    expect(dataClient.readProfile()).toBeNull();
  });

  it('validates portals structural shape', async () => {
    const { service } = makeService();

    await expect(service.savePortals('title_filter: not-a-mapping\n')).rejects.toThrow('title_filter must be a mapping');
    expect((await service.savePortals('tracked_companies: []\n')).saved).toBe(true);
  });

  it('saves strategy markdown', async () => {
    const { service, rootPath } = makeService();

    await service.saveStrategy('# Strategy\n');

    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'modes', '_profile.md'), 'utf8')).toContain('# Strategy');
  });

  it('parses resume preview and flags missing sections', async () => {
    const { service } = makeService();

    const saved = await service.saveResume(RESUME_MD);
    expect(saved.missingSections).toEqual([]);
    expect(saved.preview.name).toBe('Jane Smith');
    expect(saved.preview.experience[0].company).toBe('Acme');

    const partial = service.previewResume('# Only Name\n');
    expect(service.getResume().content).toContain('Jane Smith');
    expect(partial.name).toBe('Only Name');
  });

  it('lists generated files as downloadable assets', async () => {
    const { service, dataClient } = makeService();
    await dataClient.writeOutputFile('cv-jane-acme.pdf', Buffer.from('pdf'));

    const assets = await service.listAssets();

    expect(assets.files.map(file => file.filename)).toEqual(['cv-jane-acme.pdf']);
    expect(assets.files[0].downloadUrl).toBe('/download-pdf?file=cv-jane-acme.pdf');
  });
});
