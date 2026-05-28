import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { resolveCareerOpsPaths, resolveDataRoot } from '../../lib/path-roots.mjs';

const tenantAwareScripts = [
  '../../scan.mjs',
  '../../merge-tracker.mjs',
  '../../dedup-tracker.mjs',
  '../../normalize-statuses.mjs',
  '../../verify-pipeline.mjs'
];

describe('career-ops CLI path roots', () => {
  it('keeps system root separate from tenant data root', () => {
    const dataRoot = mkdtempSync(join(tmpdir(), 'career-ops-data-root-'));
    mkdirSync(join(dataRoot, 'data'), { recursive: true });
    writeFileSync(join(dataRoot, 'data', 'applications.md'), '# tenant tracker\n');

    const paths = resolveCareerOpsPaths({ CAREER_OPS_DATA_ROOT: dataRoot });

    expect(paths.dataRoot).toBe(dataRoot);
    expect(paths.systemRoot).not.toBe(dataRoot);
    expect(paths.portalsPath).toBe(join(dataRoot, 'portals.yml'));
    expect(paths.applicationsPath).toBe(join(dataRoot, 'data', 'applications.md'));
    expect(paths.statesPath).toContain(join('templates', 'states.yml'));
  });

  it('defaults data root to the system root for local-dev scripts', () => {
    const paths = resolveCareerOpsPaths({});

    expect(resolveDataRoot({})).toBe(paths.systemRoot);
    expect(paths.dataRoot).toBe(paths.systemRoot);
  });

  it('keeps tenant-aware root scripts on the shared path-root seam', async () => {
    for (const script of tenantAwareScripts) {
      const source = await import('fs/promises').then(fs => fs.readFile(new URL(script, import.meta.url), 'utf8'));
      expect(source).toContain('resolveCareerOpsPaths');
    }
  });
});
