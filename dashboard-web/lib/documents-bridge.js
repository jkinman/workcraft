/**
 * Narrow ESM bridge for dashboard-web (CJS) → the HTML document adapter.
 *
 * The dashboard never compiles LaTeX in-process, so importing the public
 * documents barrel would unnecessarily trace CLI/compiler filesystem code.
 */

let documentsModule;

async function loadDocuments() {
  if (!documentsModule) {
    documentsModule = await import('../../lib/documents/html-playwright.mjs');
  }
  return documentsModule;
}

async function renderHtmlToPdf(html, outputPath, opts = {}) {
  const docs = await loadDocuments();
  return docs.renderHtmlToPdf(html, outputPath, opts);
}

async function renderHtmlStringToPdfBuffer(html, opts = {}) {
  const docs = await loadDocuments();
  return docs.renderHtmlStringToPdfBuffer(html, opts);
}

module.exports = {
  loadDocuments,
  renderHtmlToPdf,
  renderHtmlStringToPdfBuffer,
};
