#!/usr/bin/env node

/**
 * generate-pdf.mjs — thin CLI facade over lib/documents (HTML → PDF via Playwright).
 */

export {
  validateCvSectionOrder,
  enforcePageBudget,
  repoRelativeManifestPath,
  injectPrintPageCss,
  inlineLocalFonts,
  renderHtmlToPdf,
  normalizeTextForATS,
  sectionKey,
} from './lib/documents/index.mjs';

import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { runGeneratePdfCli } from './lib/documents/cli.mjs';

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  runGeneratePdfCli().catch((err) => {
    console.error('❌ PDF generation failed:', err.message);
    process.exit(1);
  });
}
