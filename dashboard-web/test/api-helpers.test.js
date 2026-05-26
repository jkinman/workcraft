import { describe, expect, it } from 'vitest';
import outputFiles from '../lib/api/output-files';
import validation from '../lib/api/validation';

const { pdfDownloadHeaders, validatePdfFilename } = outputFiles;
const { validateState, validateUrl } = validation;

describe('api helpers', () => {
  it('validates tenant-safe pdf filenames', () => {
    expect(validatePdfFilename('cv-test-user-acme-2026-05-25.pdf')).toBe('cv-test-user-acme-2026-05-25.pdf');
    expect(() => validatePdfFilename('../secret.pdf')).toThrow('Invalid filename');
    expect(() => validatePdfFilename('cv-test-user-acme.pdf')).toThrow('Invalid filename');
  });

  it('builds download headers', () => {
    expect(pdfDownloadHeaders('cv-test-user-acme-2026-05-25.pdf')).toMatchObject({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv-test-user-acme-2026-05-25.pdf"'
    });
  });

  it('validates API state and URL inputs', () => {
    expect(validateState('Applied')).toBe('applied');
    expect(validateUrl('https://example.com/job')).toBe('https://example.com/job');
    expect(() => validateState('owned')).toThrow('Invalid state');
    expect(() => validateUrl('file:///tmp/secret')).toThrow('URL must use http or https');
  });
});
