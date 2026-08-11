import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const dashboardRoot = join(import.meta.dirname, '..');

const PDF_ROUTE_FILES = [
  'app/api/generate-resume/route.js',
  'app/api/generate-cover-letter/route.js',
  'app/api/generate-eval-report/route.js',
  'app/api/generate-full-eval/route.js',
];

const FORBIDDEN_IMPORTS = [
  'pdf-bundle-generator',
  'pdf-generator',
  'playwright',
  'lib/documents-bridge',
  'runInline',
];

describe('pdf route boundary', () => {
  for (const relPath of PDF_ROUTE_FILES) {
    it(`${relPath} delegates to tenant-services and pdf-route only`, () => {
      const source = readFileSync(join(dashboardRoot, relPath), 'utf8');
      expect(source).toContain('tenant-services');
      expect(source).toContain('pdf-route');
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source, `${relPath} must not import ${forbidden}`).not.toContain(forbidden);
      }
    });
  }
});
