import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const dashboardRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const WORKLOAD_ROUTE_PATTERNS = [
  { file: 'app/api/scan/route.js', forbidden: [/execFile|scan\.mjs|playwright/i], required: [/services\.runner|getTenantServices/] },
  { file: 'app/api/evaluate/route.js', forbidden: [/openai-eval|gemini-eval|lib\/evaluation\/pipeline/i], required: [/services\.runner|getTenantServices/] },
  { file: 'app/api/generate-resume/route.js', forbidden: [/execFile|scan\.mjs/i], required: [/handleHostedOrInlinePdf|getTenantServices/] },
  { file: 'app/api/generate-cover-letter/route.js', forbidden: [/execFile|scan\.mjs/i], required: [/handleHostedOrInlinePdf|getTenantServices/] },
];

describe('route thinness', () => {
  for (const route of WORKLOAD_ROUTE_PATTERNS) {
    it(`keeps ${route.file} on the workload boundary`, () => {
      const source = readFileSync(join(dashboardRoot, route.file), 'utf8');
      for (const pattern of route.required) {
        expect(source).toMatch(pattern);
      }
      for (const pattern of route.forbidden) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});

describe('express retirement', () => {
  it('removes the legacy Express entrypoint and dependency', () => {
    expect(existsSync(join(dashboardRoot, 'server.js'))).toBe(false);
    const pkg = JSON.parse(readFileSync(join(dashboardRoot, 'package.json'), 'utf8'));
    expect(pkg.dependencies.express).toBeUndefined();
    expect(pkg.scripts['legacy:start']).toBeUndefined();
  });

  it('documents Next parity in EXPRESS_PARITY.md', () => {
    const checklist = readFileSync(join(dashboardRoot, 'EXPRESS_PARITY.md'), 'utf8');
    expect(checklist).toContain('Express `server.js` retired');
    expect(checklist).toContain('api/evaluate');
  });
});
