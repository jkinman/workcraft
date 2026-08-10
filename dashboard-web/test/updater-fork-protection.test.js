import { describe, expect, it } from 'vitest';
import {
  FORK_PATHS,
  filterForkPaths,
  isForkPath
} from '../../update-system.mjs';

describe('updater fork protection', () => {
  it('protects the hosted dashboard and fork documentation', () => {
    expect(FORK_PATHS).toContain('dashboard-web/');
    expect(isForkPath('dashboard-web/app/page.jsx')).toBe(true);
    expect(isForkPath('docs/HOSTED_VERCEL_READINESS.md')).toBe(true);
    expect(isForkPath('docs/README.md')).toBe(false);
  });

  it('filters fork-owned files from expanded system directories', () => {
    expect(filterForkPaths([
      'docs/HOSTED_VERCEL_READINESS.md',
      'docs/FORK_LAYER.md',
      'docs/CODEX.md'
    ])).toEqual(['docs/CODEX.md']);
  });
});
