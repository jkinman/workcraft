/**
 * Generated document interface — adapter registry for HTML/Playwright and LaTeX.
 */

import { renderHtmlToPdf, renderHtmlStringToPdfBuffer } from './html-playwright.mjs';
import { compileLatexToPdf, validateLatexContent, detectLatexEngine } from './latex.mjs';

/** @typedef {'html-playwright'|'latex'} GeneratedDocumentAdapterId */

/** @type {Record<GeneratedDocumentAdapterId, object>} */
export const GENERATED_DOCUMENT_ADAPTERS = {
  'html-playwright': {
    id: 'html-playwright',
    renderHtmlToPdf,
    renderHtmlStringToPdfBuffer,
  },
  latex: {
    id: 'latex',
    validateLatexContent,
    compileLatexToPdf,
    detectLatexEngine,
  },
};

/**
 * @param {GeneratedDocumentAdapterId} adapterId
 */
export function getGeneratedDocumentAdapter(adapterId) {
  const adapter = GENERATED_DOCUMENT_ADAPTERS[adapterId];
  if (!adapter) throw new Error(`Unknown generated document adapter: ${adapterId}`);
  return adapter;
}

export async function renderGeneratedDocument({ adapterId = 'html-playwright', ...params }) {
  const adapter = getGeneratedDocumentAdapter(adapterId);
  if (adapterId === 'html-playwright') {
    return adapter.renderHtmlToPdf(params.html, params.outputPath, params);
  }
  return adapter.compileLatexToPdf(params);
}
