import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const dashboardRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appRoot = join(dashboardRoot, 'app');
const excludedFiles = new Set([
  'api/health/route.js',
  'layout.jsx',
  'not-found.jsx'
]);

function listAppEntrypoints(dir = appRoot) {
  return readdirSync(dir).flatMap((entry) => {
    const filePath = join(dir, entry);
    if (statSync(filePath).isDirectory()) {
      return listAppEntrypoints(filePath);
    }
    if (!/(page|route)\.(js|jsx)$/.test(entry)) {
      return [];
    }
    return [filePath];
  });
}

describe('tenant service boundary', () => {
  it('keeps active Next entrypoints on the shared tenant-services boundary', () => {
    const offenders = listAppEntrypoints()
      .filter((filePath) => !excludedFiles.has(relative(appRoot, filePath)))
      .filter((filePath) => !readFileSync(filePath, 'utf8').includes('tenant-services'))
      .map((filePath) => relative(dashboardRoot, filePath));

    expect(offenders).toEqual([]);
  });
});
