/**
 * Generated Document Module — public exports.
 */

export {
  normalizeTextForATS,
} from './ats-normalize.mjs';

export { parseCVContent } from './cv-parse.mjs';

export {
  validateCvSectionOrder,
  enforcePageBudget,
  sectionKey,
} from './cv-section-order.mjs';

export {
  repoRelativeManifestPath,
  updatePdfIndex,
  PDF_INDEX_HEADER,
} from './pdf-index.mjs';

export {
  injectPrintPageCss,
  inlineLocalFonts,
  renderHtmlToPdf,
  renderHtmlStringToPdfBuffer,
} from './html-playwright.mjs';

export {
  validateLatexContent,
  compileLatexToPdf,
  detectLatexEngine,
} from './latex.mjs';

export {
  GENERATED_DOCUMENT_ADAPTERS,
  getGeneratedDocumentAdapter,
  renderGeneratedDocument,
} from './interface.mjs';

export { runGeneratePdfCli } from './cli.mjs';
