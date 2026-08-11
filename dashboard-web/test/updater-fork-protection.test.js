import { describe, expect, it } from 'vitest';
import {
  FORK_PATHS,
  filterForkPaths,
  isForkPath
} from '../../update-system.mjs';

describe('updater fork protection', () => {
  it('protects the hosted dashboard and fork documentation', () => {
    expect(FORK_PATHS).toContain('README.md');
    expect(FORK_PATHS).toContain('AGENTS.md');
    expect(FORK_PATHS).toContain('ARCHITECTURE.md');
    expect(FORK_PATHS).toContain('dashboard-web/');
    expect(FORK_PATHS).toContain('CONTEXT.md');
    expect(FORK_PATHS).toContain('docs/adr/');
    expect(isForkPath('lib/AGENTS.md')).toBe(true);
    expect(isForkPath('lib/llm/gateway.mjs')).toBe(true);
    expect(isForkPath('lib/evaluation/pipeline.mjs')).toBe(true);
    expect(isForkPath('lib/discovery/pipeline.mjs')).toBe(true);
    expect(isForkPath('dashboard/AGENTS.md')).toBe(true);
    expect(isForkPath('docs/ARCHITECTURE.md')).toBe(true);
    expect(isForkPath('docs/PRODUCTION_RUNBOOK.md')).toBe(true);
    expect(isForkPath('dashboard-web/app/page.jsx')).toBe(true);
    expect(isForkPath('CONTEXT.md')).toBe(true);
    expect(isForkPath('docs/adr/0001-stable-entry-facades-and-deep-modules.md')).toBe(true);
    expect(isForkPath('docs/HOSTED_VERCEL_READINESS.md')).toBe(true);
    expect(isForkPath('docs/README.md')).toBe(false);
  });

  it('filters fork-owned files from expanded system directories', () => {
    expect(filterForkPaths([
      'docs/HOSTED_VERCEL_READINESS.md',
      'docs/FORK_LAYER.md',
      'docs/adr/0002-internal-llm-gateway.md',
      'docs/CODEX.md'
    ])).toEqual(['docs/CODEX.md']);
  });
});
