/**
 * ESM bridge for dashboard-web (CJS) → lib/documents/cv-parse.
 */

let cvModule;

async function loadCvParse() {
  if (!cvModule) {
    cvModule = await import('../../lib/documents/cv-parse.mjs');
  }
  return cvModule;
}

async function parseCVContent(content) {
  const mod = await loadCvParse();
  return mod.parseCVContent(content);
}

module.exports = {
  loadCvParse,
  parseCVContent,
};
