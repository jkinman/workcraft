import { describe, expect, it } from 'vitest';
import { filterForkPaths, isForkPath } from '../../update-system.mjs';

describe('update-system fork layer', () => {
  it('recognizes fork-owned paths', () => {
    expect(isForkPath('dashboard-web/app/page.jsx')).toBe(true);
    expect(isForkPath('lib/path-roots.mjs')).toBe(true);
    expect(isForkPath('docs/HOSTED_VERCEL_READINESS.md')).toBe(true);
    expect(isForkPath('docs/ARCHITECTURE.md')).toBe(true);
  });

  it('filters fork-owned paths from expanded system updates', () => {
    expect(filterForkPaths([
      'docs/ARCHITECTURE.md',
      'docs/HOSTED_VERCEL_READINESS.md',
      'dashboard-web/app/page.jsx',
      'scan.mjs'
    ])).toEqual(['scan.mjs']);
  });
});
